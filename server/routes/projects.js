import { Router } from 'express';
import { authRequired } from '../auth/index.js';
import { listProjectsWithDocuments } from '../services/documents.js';
import { query } from '../db.js';

const router = Router();

router.get('/', authRequired, async (req, res) => {
  try {
    const projects = await listProjectsWithDocuments();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authRequired, async (req, res) => {
  try {
    const result = await query(`SELECT id, name, hall_code FROM projects WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json({ project: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
