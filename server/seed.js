import { migrate, pool } from './db.js';
import { ensureAdminUser } from './auth/index.js';
import { seedFromFilesystem } from './services/documents.js';

async function main() {
  await migrate();
  await ensureAdminUser();
  const result = await seedFromFilesystem();
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
