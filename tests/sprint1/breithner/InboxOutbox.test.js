import { describe,test,expect } from '@jest/globals';
import { makeMySqlRuntime } from './mysqlFixture.js';
import { event,tenantId } from './fixtures.js';

const sqlTest = process.env.TEST_DATABASE_URL ? test : test.skip;
describe('ET15 MySQL real',() => {
    sqlTest('un éxito crea inbox y outbox una sola vez',async () => {
        const r = await makeMySqlRuntime();
        try {
            const input = { tenantId,actorId: 'test-user',sourceId: 'device-01',event };
            await r.processor.process(input); await r.processor.process(input);
            for (const table of ['mineral_lots','trace_events','event_inbox','event_outbox']) {
                const [result] = await r.pool.query(`SELECT count(*) AS n FROM ${table}`);
                expect(Number(result[0].n)).toBe(1);
            }
        } finally { await r.close(); }
    });
    sqlTest('fallo del outbox revierte también el lote y el inbox',async () => {
        const r = await makeMySqlRuntime();
        try {
            r.journal.appendOutbox = async () => { throw new Error('fallo simulado'); };
            await expect(r.processor.process({ tenantId,actorId: 'test-user',
                sourceId: 'device-01',event })).rejects.toThrow('fallo simulado');
            for (const table of ['mineral_lots','trace_events','origin_evidence','event_inbox']) {
                const [result] = await r.pool.query(`SELECT count(*) AS n FROM ${table}`);
                expect(Number(result[0].n)).toBe(0);
            }
        } finally { await r.close(); }
    });
});
