import express from 'express';
import cors from 'cors';
import path from 'path';
import { createYoga } from 'graphql-yoga';
import { config } from './config.js';
import { migrate, pool } from './db.js';
import { ensureAdminUser } from './auth/index.js';
import { seedFromFilesystem } from './services/documents.js';
import { yogaSchema, getUserFromContext } from './graphql/schema.js';

import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import documentsRoutes, { createSyncRouter } from './routes/documents.js';
import mediaRoutes from './routes/media.js';
import publicRoutes from './routes/public.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'utkina-cms' });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/projects/:id/documents', documentsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/sync', createSyncRouter());
app.use('/api/public', publicRoutes);

const yoga = createYoga({
  schema: yogaSchema,
  graphqlEndpoint: '/graphql',
  context: ({ request }) => ({
    user: getUserFromContext(request),
  }),
});
app.use(yoga.graphqlEndpoint, yoga);

app.use(express.static(config.staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/graphql')) return next();
  res.sendFile(path.join(config.staticDir, 'index.html'), (err) => {
    if (err) next();
  });
});

async function bootstrap() {
  console.log('Migrating database…');
  await migrate();
  await ensureAdminUser();
  const seeded = await seedFromFilesystem();
  console.log(`Seed: ${seeded.projectsCount} projects, ${seeded.docsCount} new documents`);

  app.listen(config.port, () => {
    console.log(`CMS Admin API: http://localhost:${config.port}`);
    console.log(`GraphQL:       http://localhost:${config.port}/graphql`);
    console.log(`Login:         ${config.adminLogin} / (ADMIN_PASSWORD or default)`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start CMS:', err);
  pool.end().finally(() => process.exit(1));
});
