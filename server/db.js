import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function query(text, params) {
  return pool.query(text, params);
}

export async function migrate() {
  const sqlPath = path.join(__dirname, 'db', 'migrations', '001_init.sql');
  const sql = await fs.readFile(sqlPath, 'utf-8');
  await pool.query(sql);
}

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
