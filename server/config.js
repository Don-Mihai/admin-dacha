import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '..');

/** Дефолты — админка запускается без `.env` (файл опционален). */
export const defaults = {
  PORT: 3333,
  DATABASE_URL: 'postgresql://utkina:utkina@localhost:5432/utkina_cms',
  JWT_SECRET: 'dev-secret-change-me-in-production',
  JWT_EXPIRES_IN: '12h',
  PROJECTS_ROOT: '..',
  ADMIN_LOGIN: 'admin',
  ADMIN_PASSWORD: 'admin123',
};

dotenv.config({ path: path.join(appDir, '.env') });

const projectsRoot = path.resolve(appDir, process.env.PROJECTS_ROOT || defaults.PROJECTS_ROOT);

export const config = {
  port: Number(process.env.PORT) || defaults.PORT,
  databaseUrl: process.env.DATABASE_URL || defaults.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || defaults.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || defaults.JWT_EXPIRES_IN,
  projectsRoot,
  appDir,
  staticDir: path.join(appDir, 'build'),
  adminLogin: process.env.ADMIN_LOGIN || defaults.ADMIN_LOGIN,
  adminPassword: process.env.ADMIN_PASSWORD || defaults.ADMIN_PASSWORD,
};
