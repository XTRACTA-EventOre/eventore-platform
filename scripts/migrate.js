import 'dotenv/config';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL');
const tx = await pool.connect();
try {
  await tx.query('BEGIN');
  await tx.query('SELECT pg_advisory_xact_lock(741092)');
  await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of ['lots/001_register_lots.sql', 'messaging/002_inbox_outbox.sql', 'identity/003_sessions.sql']) {
    const applied = await tx.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (applied.rowCount) continue;
    // Existing Sprint 1 installations may baseline their already-applied SQL explicitly.
    const baseline = process.argv.includes('--baseline-sprint1') && !name.startsWith('identity/');
    if (baseline) {
      const tables = name.startsWith('lots/') ? ['mineral_lots','origin_evidence','trace_events'] : ['event_inbox','event_outbox'];
      for (const table of tables) {
        const r = await tx.query('SELECT to_regclass($1) AS name', [table]);
        if (!r.rows[0].name) throw new Error(`No se puede registrar la migración existente: falta ${table}`);
      }
    } else await tx.query(await readFile(new URL(`../database/migrations/${name}`, import.meta.url), 'utf8'));
    await tx.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    console.log(`Migración aplicada: ${name}`);
  }
  await tx.query('COMMIT');
} catch (e) { await tx.query('ROLLBACK'); throw e; }
finally { tx.release(); await pool.end(); }
