import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';
import { query, withClient } from '../db.js';
import { documentKeyFromFile } from '../sync/writeJson.js';

const SKIP_DIRS = new Set(['admin-dacha', 'admin', 'node_modules', '.git', 'scripts']);

async function listProjectDataFiles(projectId) {
  const dataDir = path.join(config.projectsRoot, projectId, 'public', 'data');
  try {
    const files = await fs.readdir(dataDir);
    return files.filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

export async function seedFromFilesystem() {
  const entries = await fs.readdir(config.projectsRoot, { withFileTypes: true });
  let projectsCount = 0;
  let docsCount = 0;

  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.includes('информация') || entry.name.includes('заполнения')) continue;

        const jsonFiles = await listProjectDataFiles(entry.name);
        if (!jsonFiles.length) continue;

        await client.query(
          `INSERT INTO projects (id, name) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
          [entry.name, entry.name],
        );
        projectsCount += 1;

        for (const fileName of jsonFiles) {
          const fullPath = path.join(config.projectsRoot, entry.name, 'public', 'data', fileName);
          let payload;
          try {
            const raw = await fs.readFile(fullPath, 'utf-8');
            payload = JSON.parse(raw);
          } catch (err) {
            console.warn(`Skip invalid JSON: ${fullPath}`, err.message);
            continue;
          }

          const documentKey = documentKeyFromFile(fileName);
          const docRes = await client.query(
            `INSERT INTO content_documents (project_id, document_key, file_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (project_id, document_key)
             DO UPDATE SET file_name = EXCLUDED.file_name
             RETURNING id`,
            [entry.name, documentKey, fileName],
          );
          const documentId = docRes.rows[0].id;

          const revCheck = await client.query(
            `SELECT id FROM content_revisions WHERE document_id = $1 AND is_published = TRUE ORDER BY updated_at DESC LIMIT 1`,
            [documentId],
          );

          if (!revCheck.rows.length) {
            await client.query(
              `INSERT INTO content_revisions (document_id, payload, is_published)
               VALUES ($1, $2::jsonb, TRUE)`,
              [documentId, JSON.stringify(payload)],
            );
            docsCount += 1;
          }
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });

  return { projectsCount, docsCount };
}

/** Used by sync: get latest published payload for all docs of a project */
export async function getPublishedDocuments(projectId = null) {
  const params = [];
  let where = '';
  if (projectId) {
    params.push(projectId);
    where = 'WHERE d.project_id = $1';
  }
  const result = await query(
    `SELECT DISTINCT ON (d.id)
       d.id AS document_id,
       d.project_id,
       d.document_key,
       d.file_name,
       r.payload,
       r.updated_at
     FROM content_documents d
     JOIN content_revisions r ON r.document_id = d.id AND r.is_published = TRUE
     ${where}
     ORDER BY d.id, r.updated_at DESC`,
    params,
  );
  return result.rows;
}

export async function getDocumentPayload(projectId, documentKey) {
  const result = await query(
    `SELECT d.id, d.project_id, d.document_key, d.file_name, r.payload, r.updated_at, r.updated_by
     FROM content_documents d
     JOIN content_revisions r ON r.document_id = d.id AND r.is_published = TRUE
     WHERE d.project_id = $1 AND d.document_key = $2
     ORDER BY r.updated_at DESC
     LIMIT 1`,
    [projectId, documentKey],
  );
  return result.rows[0] || null;
}

export async function listProjectsWithDocuments() {
  const projects = await query(`SELECT id, name, hall_code FROM projects ORDER BY name`);
  const docs = await query(
    `SELECT project_id, document_key, file_name FROM content_documents ORDER BY file_name`,
  );
  const byProject = new Map();
  for (const p of projects.rows) {
    byProject.set(p.id, { id: p.id, name: p.name, hall_code: p.hall_code, dataFiles: [] });
  }
  for (const d of docs.rows) {
    const p = byProject.get(d.project_id);
    if (p) {
      p.dataFiles.push({
        name: d.file_name,
        path: `data/${d.file_name}`,
        key: d.document_key,
      });
    }
  }
  return [...byProject.values()];
}

export async function saveDocumentRevision(projectId, documentKey, payload, userId) {
  const docRes = await query(
    `SELECT id, file_name FROM content_documents WHERE project_id = $1 AND document_key = $2`,
    [projectId, documentKey],
  );
  let documentId;
  let fileName;
  if (!docRes.rows.length) {
    fileName = `${documentKey}.json`;
    const inserted = await query(
      `INSERT INTO content_documents (project_id, document_key, file_name)
       VALUES ($1, $2, $3) RETURNING id, file_name`,
      [projectId, documentKey, fileName],
    );
    documentId = inserted.rows[0].id;
    fileName = inserted.rows[0].file_name;
  } else {
    documentId = docRes.rows[0].id;
    fileName = docRes.rows[0].file_name;
  }

  await query(
    `INSERT INTO content_revisions (document_id, payload, is_published, updated_by)
     VALUES ($1, $2::jsonb, TRUE, $3)`,
    [documentId, JSON.stringify(payload), userId ?? null],
  );

  return { documentId, fileName, projectId, documentKey, payload };
}
