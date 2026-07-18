import { createSchema } from 'graphql-yoga';
import { authenticate, signToken, verifyToken, audit } from '../auth/index.js';
import { query } from '../db.js';
import {
  listProjectsWithDocuments,
  getDocumentPayload,
  saveDocumentRevision,
} from '../services/documents.js';
import { writeDocumentToDisk } from '../sync/writeJson.js';

function getUserFromContext(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    return { id: payload.sub, login: payload.login, role: payload.role };
  } catch {
    return null;
  }
}

export const yogaSchema = createSchema({
  typeDefs: /* GraphQL */ `
    type User {
      id: Int!
      login: String!
      role: String!
    }

    type DataFile {
      name: String!
      path: String!
      key: String!
    }

    type Project {
      id: String!
      name: String!
      hallCode: String
      dataFiles: [DataFile!]!
    }

    type Document {
      projectId: String!
      key: String!
      fileName: String!
      payload: String!
      updatedAt: String
    }

    type MediaAsset {
      id: Int!
      projectId: String!
      path: String!
      url: String!
      mime: String
      size: Float
    }

    type AuthPayload {
      token: String!
      user: User!
    }

    type UpdateResult {
      ok: Boolean!
      projectId: String!
      key: String!
      synced: Boolean!
    }

    type Query {
      me: User
      projects: [Project!]!
      document(projectId: String!, key: String!): Document
      media(projectId: String): [MediaAsset!]!
    }

    type Mutation {
      login(login: String!, password: String!): AuthPayload!
      updateDocument(projectId: String!, key: String!, payload: String!): UpdateResult!
    }
  `,
  resolvers: {
    Query: {
      me: (_parent, _args, ctx) => ctx.user,
      projects: async (_parent, _args, ctx) => {
        if (!ctx.user) throw new Error('Unauthorized');
        const projects = await listProjectsWithDocuments();
        return projects.map((p) => ({
          id: p.id,
          name: p.name,
          hallCode: p.hall_code,
          dataFiles: p.dataFiles,
        }));
      },
      document: async (_parent, { projectId, key }, ctx) => {
        if (!ctx.user) throw new Error('Unauthorized');
        const doc = await getDocumentPayload(projectId, key);
        if (!doc) return null;
        return {
          projectId: doc.project_id,
          key: doc.document_key,
          fileName: doc.file_name,
          payload: JSON.stringify(doc.payload),
          updatedAt: doc.updated_at?.toISOString?.() ?? String(doc.updated_at),
        };
      },
      media: async (_parent, { projectId }, ctx) => {
        if (!ctx.user) throw new Error('Unauthorized');
        const params = projectId ? [projectId] : [];
        const where = projectId ? 'WHERE project_id = $1' : '';
        const result = await query(
          `SELECT id, project_id, path, url, mime, size FROM media_assets ${where} ORDER BY created_at DESC LIMIT 200`,
          params,
        );
        return result.rows.map((r) => ({
          id: r.id,
          projectId: r.project_id,
          path: r.path,
          url: r.url,
          mime: r.mime,
          size: r.size ? Number(r.size) : null,
        }));
      },
    },
    Mutation: {
      login: async (_parent, { login, password }) => {
        const user = await authenticate(login, password);
        if (!user) throw new Error('Invalid credentials');
        const token = signToken(user);
        await audit(user.id, 'login_graphql', 'auth', { login: user.login });
        return { token, user };
      },
      updateDocument: async (_parent, { projectId, key, payload }, ctx) => {
        if (!ctx.user) throw new Error('Unauthorized');
        if (!['admin', 'editor'].includes(ctx.user.role)) throw new Error('Forbidden');
        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch {
          throw new Error('Invalid JSON payload');
        }
        const saved = await saveDocumentRevision(projectId, key, parsed, ctx.user.id);
        await writeDocumentToDisk(projectId, saved.fileName, saved.payload);
        await audit(ctx.user.id, 'update_document_graphql', `${projectId}/${key}`, {});
        return { ok: true, projectId, key, synced: true };
      },
    },
  },
});

export { getUserFromContext };
