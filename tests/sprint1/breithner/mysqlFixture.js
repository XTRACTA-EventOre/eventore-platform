import { randomUUID } from 'node:crypto';
import { createMySqlPool } from '../../../src/shared/infrastructure/persistence/mysql.js';
import { migrationSets, runMigrations } from '../../../src/shared/infrastructure/persistence/runMigrations.js';
import { MySqlUnitOfWork, MySqlLotStore } from '../../../src/contexts/traceability/infrastructure/persistence/lots/MySqlLotStore.js';
import { MySqlEventJournal } from '../../../src/contexts/traceability/infrastructure/persistence/messaging/MySqlEventJournal.js';
import { TraceabilityEventProcessor } from '../../../src/contexts/traceability/application/services/processing/TraceabilityEventProcessor.js';
import { EventReplayGuard } from '../../../src/contexts/traceability/application/services/processing/EventReplayGuard.js';

export async function makeMySqlRuntime({ service } = {}) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (url.protocol !== 'mysql:' || !decodeURIComponent(url.pathname).endsWith('_test')) {
    throw new Error('Usa únicamente una base MySQL cuyo nombre termine en _test');
  }
  const admin = createMySqlPool(String(url));
  const database = 'eventore_' + randomUUID().replaceAll('-', '') + '_test';
  let pool;
  async function close() {
    try { await pool?.end(); }
    finally {
      try { await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); }
      finally { await admin.end(); }
    }
  }
  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
    url.pathname = '/' + database;
    pool = createMySqlPool(String(url));
    await runMigrations(pool, service ? migrationSets[service] : [...migrationSets.traceability, ...migrationSets.identity]);
    const unitOfWork = new MySqlUnitOfWork(pool), lotStore = new MySqlLotStore(pool);
    const journal = new MySqlEventJournal();
    const processor = new TraceabilityEventProcessor({ unitOfWork, lotStore, journal, replayGuard: new EventReplayGuard() });
    return { pool, unitOfWork, lotStore, journal, processor, close };
  } catch (error) { await close(); throw error; }
}
