import { Router } from 'express';
import { authRequired, requireRole, audit } from '../auth/index.js';
import {
  getDocumentPayload,
  saveDocumentRevision,
  getPublishedDocuments,
} from '../services/documents.js';
import { writeDocumentToDisk, syncProjectDocuments } from '../sync/writeJson.js';

const router = Router({ mergeParams: true });

router.get('/:key', authRequired, async (req, res) => {
  try {
    const { id: projectId, key } = req.params;
    const doc = await getDocumentPayload(projectId, key);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json({
      projectId: doc.project_id,
      key: doc.document_key,
      fileName: doc.file_name,
      payload: doc.payload,
      updatedAt: doc.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:key', authRequired, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const { id: projectId, key } = req.params;
    let payload = req.body?.payload ?? req.body?.content ?? req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON content' });
      }
    }
    if (payload === undefined) return res.status(400).json({ error: 'payload required' });

    const saved = await saveDocumentRevision(projectId, key, payload, req.user.id);
    await writeDocumentToDisk(projectId, saved.fileName, saved.payload);
    await audit(req.user.id, 'update_document', `${projectId}/${key}`, { fileName: saved.fileName });

    res.json({
      ok: true,
      projectId,
      key,
      fileName: saved.fileName,
      synced: true,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

export function createSyncRouter() {
  const syncRouter = Router();

  syncRouter.post('/:projectId', authRequired, requireRole('admin', 'editor'), async (req, res) => {
    try {
      const docs = await getPublishedDocuments(req.params.projectId);
      if (!docs.length) return res.status(404).json({ error: 'No documents for project' });
      const written = await syncProjectDocuments(docs);
      await audit(req.user.id, 'sync_project', req.params.projectId, { files: written.length });
      res.json({ ok: true, written });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  syncRouter.post('/', authRequired, requireRole('admin'), async (req, res) => {
    try {
      const docs = await getPublishedDocuments();
      const written = await syncProjectDocuments(docs);
      await audit(req.user.id, 'sync_all', 'all', { files: written.length });
      res.json({ ok: true, written });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return syncRouter;
}
