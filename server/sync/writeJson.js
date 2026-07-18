import fs from 'fs/promises';
import path from 'path';
import { config } from '../config.js';

/** document_key from file name: catalogItems.json -> catalogItems */
export function documentKeyFromFile(fileName) {
  return path.basename(fileName, '.json');
}

export function filePathForDocument(projectId, fileName) {
  return path.join(config.projectsRoot, projectId, 'public', 'data', fileName);
}

export async function writeDocumentToDisk(projectId, fileName, payload) {
  const fullPath = filePathForDocument(projectId, fileName);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(fullPath, content, 'utf-8');
  return fullPath;
}

export async function syncProjectDocuments(documents) {
  const written = [];
  for (const doc of documents) {
    await writeDocumentToDisk(doc.project_id, doc.file_name, doc.payload);
    written.push(`${doc.project_id}/public/data/${doc.file_name}`);
  }
  return written;
}
