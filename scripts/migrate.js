import 'dotenv/config';
import { createMySqlPool } from '../src/shared/infrastructure/persistence/mysql.js';
import { migrationSets, runMigrations } from '../src/shared/infrastructure/persistence/runMigrations.js';
if (process.argv.length > 2) throw new Error('MySQL requiere una base nueva; no se admite baseline de PostgreSQL');
const pool = createMySqlPool(process.env.DATABASE_URL);
try { await runMigrations(pool, [...migrationSets.traceability, ...migrationSets.identity]); }
finally { await pool.end(); }
