import { Router } from 'express';
import { getDocumentPayload, listProjectsWithDocuments } from '../services/documents.js';

const router = Router();

/** Public read API for kiosks — no JWT */
router.get('/projects', async (req, res) => {
  try {
    const projects = await listProjectsWithDocuments();
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id/documents/:key', async (req, res) => {
  try {
    const doc = await getDocumentPayload(req.params.id, req.params.key);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(doc.payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
