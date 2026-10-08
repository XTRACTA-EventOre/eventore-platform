import { describe,test,expect } from '@jest/globals';
import request from 'supertest';
import { makeMemoryRuntime,makeApp,body,event } from './fixtures.js';

describe('ET12 sincronización',() => {
    test('acepta y después reconoce el reintento',async () => {
        const runtime = makeMemoryRuntime(); const { app } = makeApp(runtime);
        const first = await request(app).post('/api/v1/events/synchronize').send(body);
        const retry = await request(app).post('/api/v1/events/synchronize').send(body);
        expect(first.body.results[0].status).toBe('Accepted');
        expect(retry.body.results[0].status).toBe('AlreadyProcessed');
        expect(retry.body.results[0].lotId).toBe(first.body.results[0].lotId);
    });
    test('mismo ID con distinto peso produce Conflict',async () => {
        const { app } = makeApp(makeMemoryRuntime());
        await request(app).post('/api/v1/events/synchronize').send(body);
        const changed = { ...event,payload: { ...event.payload,weight: '80' } };
        const res = await request(app).post('/api/v1/events/synchronize')
            .send({ ...body,events: [changed] });
        expect(res.body.results[0].status).toBe('Conflict');
    });
    test('batch válido puede mezclar Accepted y Rejected',async () => {
        const { app } = makeApp(makeMemoryRuntime());
        const invalid = { ...event,clientEventId: '44444444-4444-4444-8444-444444444444',
            payload: { ...event.payload,weight: '0' } };
        const res = await request(app).post('/api/v1/events/synchronize')
            .send({ ...body,events: [event,invalid] });
        expect(res.status).toBe(200);
        expect(res.body.results.map(r => r.status)).toEqual(['Accepted','Rejected']);
    });
    test('estructura inválida no procesa ningún evento',async () => {
        const runtime = makeMemoryRuntime();
        const res = await request(makeApp(runtime).app).post('/api/v1/events/synchronize')
            .send({ ...body,events: [event,{ ...event,dependencies: 'incorrecto' }] });
        expect(res.status).toBe(400); expect(runtime.data.lots.size).toBe(0);
    });
    test('fallo de almacenamiento devuelve 503',async () => {
        const runtime = makeMemoryRuntime();
        runtime.lotStore.save = async () => { throw new Error('sin conexión'); };
        const res = await request(makeApp(runtime).app).post('/api/v1/events/synchronize').send(body);
        expect(res.status).toBe(503); expect(runtime.data.inbox.size).toBe(0);
    });
});
