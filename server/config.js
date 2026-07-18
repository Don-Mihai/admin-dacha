import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(appDir, '.env') });

const projectsRoot = path.resolve(appDir, process.env.PROJECTS_ROOT || '..');

export const config = {
  port: Number(process.env.PORT) || 3333,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://utkina:utkina@localhost:5432/utkina_cms',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  projectsRoot,
  appDir,
  staticDir: path.join(appDir, 'build'),
  adminLogin: process.env.ADMIN_LOGIN || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
};
