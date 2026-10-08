import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PgUnitOfWork,PgLotStore } from '../../../src/contexts/traceability/infrastructure/persistence/lots/PgLotStore.js';
import { PgEventJournal } from '../../../src/contexts/traceability/infrastructure/persistence/messaging/PgEventJournal.js';
import { TraceabilityEventProcessor } from '../../../src/contexts/traceability/application/services/processing/TraceabilityEventProcessor.js';
import { EventReplayGuard } from '../../../src/contexts/traceability/application/services/processing/EventReplayGuard.js';

export async function makePgRuntime() {
    const connectionString = process.env.TEST_DATABASE_URL;
    if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
        throw new Error('Usa únicamente una base cuyo nombre termine en _test');
    }
    const { Pool } = await import('pg');
    const admin = new Pool({ connectionString });
    const schema = 'sprint1_test_' + randomUUID().replaceAll('-','');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const pool = new Pool({ connectionString,options: `-c search_path=${schema}` });
    async function close() {
        await pool.end();
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
        await admin.end();
    }
    try {
        for (const file of ['lots/001_register_lots.sql','messaging/002_inbox_outbox.sql']) {
            const sql = await readFile(new URL('../../../database/migrations/'+file,import.meta.url),'utf8');
            await pool.query(sql);
        }
        const unitOfWork = new PgUnitOfWork(pool);
        const lotStore = new PgLotStore(pool); const journal = new PgEventJournal();
        const processor = new TraceabilityEventProcessor({ unitOfWork,lotStore,journal,
            replayGuard: new EventReplayGuard() });
        return { pool,unitOfWork,lotStore,journal,processor,close };
    } catch (error) { await close(); throw error; }
}
