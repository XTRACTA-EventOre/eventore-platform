import { describe,test,expect } from '@jest/globals';
import request from 'supertest';
import { makeMemoryRuntime,makeApp,body,event,tenantId } from '../breithner/fixtures.js';
import { makePgRuntime } from '../breithner/pgFixture.js';

describe('ET16 reintentos',() => {
    test('mismo ID crea un solo efecto',async () => {
        const r = makeMemoryRuntime(); const { app } = makeApp(r);
        const first = await request(app).post('/api/v1/events/synchronize').send(body);
        const retry = await request(app).post('/api/v1/events/synchronize').send(body);
        expect(first.status).toBe(200); expect(retry.status).toBe(200);
        expect(first.body.results[0].status).toBe('Accepted');
        expect(retry.body.results[0].status).toBe('AlreadyProcessed');
        expect(r.data.lots.size).toBe(1); expect(r.data.outbox).toHaveLength(1);
    });
    test('IDs distintos con payload igual no se descartan',async () => {
        const r = makeMemoryRuntime(); const { app } = makeApp(r);
        await request(app).post('/api/v1/events/synchronize').send(body);
        await request(app).post('/api/v1/events/synchronize').send({ ...body,events: [
                { ...event,clientEventId: '44444444-4444-4444-8444-444444444444' } ] });
        expect(r.data.lots.size).toBe(2);
    });
    const sqlTest = process.env.TEST_DATABASE_URL ? test : test.skip;
    sqlTest('dos solicitudes concurrentes producen un solo lote',async () => {
        const r = await makePgRuntime();
        try {
            const input = { tenantId,actorId: 'test-user',sourceId: 'device-01',event };
            const result = await Promise.all([r.processor.process(input),r.processor.process(input)]);
            expect(result.map(x => x.status).sort()).toEqual(['Accepted','AlreadyProcessed']);
            expect(new Set(result.map(x => x.lotId)).size).toBe(1);
            const count = await r.pool.query('SELECT count(*)::int AS n FROM mineral_lots');
            expect(count.rows[0].n).toBe(1);
        } finally { await r.close(); }
    });
});