import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { authRequired, requireRole, audit } from '../auth/index.js';
import { config } from '../config.js';
import { query } from '../db.js';

const router = Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const project = req.body.project || req.query.project;
    const relativePath = (req.body.path || req.query.path || 'data/images').replace(/^\/+/, '');
    if (!project) return cb(new Error('project required'));
    const dest = path.join(config.projectsRoot, project, 'public', relativePath);
    try {
      await fs.mkdir(dest, { recursive: true });
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const name = file.originalname || `upload-${Date.now()}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

router.get('/', authRequired, async (req, res) => {
  try {
    const { project } = req.query;
    const params = [];
    let where = '';
    if (project) {
      params.push(project);
      where = 'WHERE project_id = $1';
    }
    const result = await query(
      `SELECT id, project_id, path, url, mime, size, created_at
       FROM media_assets ${where}
       ORDER BY created_at DESC
       LIMIT 500`,
      params,
    );
    res.json({ media: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authRequired, requireRole('admin', 'editor'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const project = req.body.project;
    if (!project) return res.status(400).json({ error: 'project required' });
    const relativePath = (req.body.path || 'data/images').replace(/^\/+/, '');
    const url = `/${path.join(relativePath, req.file.filename).replace(/\\/g, '/')}`;
    const diskPath = path.join(relativePath, req.file.filename).replace(/\\/g, '/');

    const result = await query(
      `INSERT INTO media_assets (project_id, path, url, mime, size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, project_id, path, url, mime, size, created_at`,
      [project, diskPath, url, req.file.mimetype, req.file.size, req.user.id],
    );
    await audit(req.user.id, 'upload_media', project, { url, path: diskPath });
    res.status(201).json({ ...result.rows[0], filename: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** List files on disk (legacy helper for UI) */
router.get('/files', authRequired, async (req, res) => {
  const { project, subpath = 'data/images' } = req.query;
  if (!project) return res.status(400).json({ error: 'project required' });
  const safePath = path.normalize(subpath).replace(/^(\.\.(\/|\\))+/g, '');
  const fullPath = path.join(config.projectsRoot, project, 'public', safePath);
  if (!fullPath.startsWith(path.join(config.projectsRoot, project))) {
    return res.status(400).json({ error: 'invalid path' });
  }
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    res.json({ files });
  } catch (err) {
    if (err.code === 'ENOENT') return res.json({ files: [] });
    res.status(500).json({ error: err.message });
  }
});

export default router;
