import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const staticDir = path.join(__dirname, 'dist');
const fallbackDir = path.join(__dirname, 'public');
const useDist = existsSync(staticDir);
app.use(express.static(useDist ? staticDir : fallbackDir));

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const project = req.body.project || req.query.project;
    const relativePath = (req.body.path || req.query.path || 'data/images').replace(/^\/+/, '');
    if (!project) return cb(new Error('project required'));
    const dest = path.join(PROJECTS_ROOT, project, 'public', relativePath);
    await fs.mkdir(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const name = file.originalname || `upload-${Date.now()}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

/** Список проектов и их data-файлов */
app.get('/api/projects', async (req, res) => {
  try {
    const entries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true });
    const projects = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'admin') continue;
      const dataDir = path.join(PROJECTS_ROOT, e.name, 'public', 'data');
      try {
        await fs.access(dataDir);
      } catch {
        continue;
      }
      const files = await fs.readdir(dataDir);
      const dataFiles = files.filter((f) => f.endsWith('.json')).map((f) => ({ name: f, path: `data/${f}` }));
      if (dataFiles.length) projects.push({ id: e.name, name: e.name, dataFiles });
    }
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Прочитать JSON-файл */
app.get('/api/file', async (req, res) => {
  const { project, file } = req.query;
  if (!project || !file) return res.status(400).json({ error: 'project and file required' });
  const safePath = path.normalize(file).replace(/^(\.\.(\/|\\))+/g, '');
  const fullPath = path.join(PROJECTS_ROOT, project, 'public', safePath);
  if (!fullPath.startsWith(path.join(PROJECTS_ROOT, project))) return res.status(400).json({ error: 'invalid path' });
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    res.status(500).json({ error: err.message });
  }
});

/** Записать JSON-файл */
app.put('/api/file', async (req, res) => {
  const { project, file } = req.query;
  if (!project || !file) return res.status(400).json({ error: 'project and file required' });
  const safePath = path.normalize(file).replace(/^(\.\.(\/|\\))+/g, '');
  const fullPath = path.join(PROJECTS_ROOT, project, 'public', safePath);
  if (!fullPath.startsWith(path.join(PROJECTS_ROOT, project))) return res.status(400).json({ error: 'invalid path' });
  try {
    const content = req.body?.content != null ? req.body.content : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2));
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Загрузка изображения */
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const relativePath = (req.body.path || 'data/images').replace(/^\/+/, '');
  const url = `/${path.join(relativePath, req.file.filename).replace(/\\/g, '/')}`;
  res.json({ url, filename: req.file.filename });
});

/** Список файлов в папке (например images) для выбора пути */
app.get('/api/images', async (req, res) => {
  const { project, subpath = 'data/images' } = req.query;
  if (!project) return res.status(400).json({ error: 'project required' });
  const safePath = path.normalize(subpath).replace(/^(\.\.(\/|\\))+/g, '');
  const fullPath = path.join(PROJECTS_ROOT, project, 'public', safePath);
  if (!fullPath.startsWith(path.join(PROJECTS_ROOT, project))) return res.status(400).json({ error: 'invalid path' });
  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    res.json({ files });
  } catch (err) {
    if (err.code === 'ENOENT') return res.json({ files: [] });
    res.status(500).json({ error: err.message });
  }
});

if (useDist) {
  app.get('*', (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
}

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => console.log(`Admin: http://localhost:${PORT}`));
