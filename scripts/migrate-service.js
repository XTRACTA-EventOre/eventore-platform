import 'dotenv/config';
import { createMySqlPool } from '../src/shared/infrastructure/persistence/mysql.js';
import { migrationSets, runMigrations } from '../src/shared/infrastructure/persistence/runMigrations.js';
const service = process.argv[2];
if (!migrationSets[service]) throw new Error('Uso: node scripts/migrate-service.js identity|traceability');
const pool = createMySqlPool(process.env.DATABASE_URL);
try { await runMigrations(pool, migrationSets[service]); }
finally { await pool.end(); }
