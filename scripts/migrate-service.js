import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

const migrations = {
  identity: ['identity/003_sessions.sql'],
  traceability: ['lots/001_register_lots.sql', 'messaging/002_inbox_outbox.sql']
};
const service = process.argv[2];
if (!migrations[service] || !process.env.DATABASE_URL) {
  throw new Error('Uso: DATABASE_URL=... node scripts/migrate-service.js identity|traceability');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const tx = await pool.connect();
try {
  await tx.query('BEGIN');
  await tx.query('SELECT pg_advisory_xact_lock(741092)');
  await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of migrations[service]) {
    const applied = await tx.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (applied.rowCount) continue;
    await tx.query(await readFile(new URL(`../database/migrations/${name}`, import.meta.url), 'utf8'));
    await tx.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    console.log(`Migración aplicada: ${name}`);
  }
  await tx.query('COMMIT');
} catch (error) { await tx.query('ROLLBACK'); throw error; }
finally { tx.release(); await pool.end(); }
