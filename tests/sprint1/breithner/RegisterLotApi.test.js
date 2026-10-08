import { describe,test,expect } from '@jest/globals';
import request from 'supertest';
import { makeMemoryRuntime,makeApp,payload,clientEventId,tenantId } from './fixtures.js';

describe('ET04 registro',() => {
    test('crea lote y evidencia pendiente',async () => {
        const runtime = makeMemoryRuntime();
        const { app } = makeApp(runtime);
        const res = await request(app).post('/api/v1/lots').send({ clientEventId,...payload });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ status: 'Registered',version: 1,
            originEvidenceStatus: 'PendingReview' });
        expect(runtime.data.lots.size).toBe(1);
        expect(runtime.data.outbox).toHaveLength(1);
    });
    test('peso cero no crea lote',async () => {
        const runtime = makeMemoryRuntime();
        const res = await request(makeApp(runtime).app).post('/api/v1/lots')
            .send({ clientEventId,...payload,weight: '0' });
        expect(res.status).toBe(400);
        expect(runtime.data.lots.size).toBe(0);
    });
    test('sin sesión devuelve 401',async () => {
        const app = makeApp(makeMemoryRuntime(),{ authenticated: false }).app;
        const res = await request(app).post('/api/v1/lots').send({ clientEventId,...payload });
        expect(res.status).toBe(401);
    });
    test('el body no cambia la organización',async () => {
        const runtime = makeMemoryRuntime();
        await request(makeApp(runtime).app).post('/api/v1/lots')
            .send({ clientEventId,...payload,tenantId: '99999999-9999-4999-8999-999999999999' });
        expect([...runtime.data.lots.values()][0].tenantId).toBe(tenantId);
    });
});
