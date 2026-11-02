import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { makePgRuntime } from './breithner/pgFixture.js';
import { createSessionAuth, hashPassword } from '../../src/shared/infrastructure/http/sessionAuth.js';
import { createSprint1App } from '../../src/contexts/traceability/infrastructure/bootstrap/createSprint1App.js';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Sesion real y flujo integrado PostgreSQL', () => {
  let runtime, app;
  const tenant = randomUUID(), password = 'Sprint1-test-password';
  beforeAll(async () => {
    runtime = await makePgRuntime();
    const hash = await hashPassword(password);
    for (const [email, organization] of [['a@example.test', tenant], ['b@example.test', randomUUID()], ['locked@example.test', tenant]]) {
      await runtime.pool.query('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES($1,$2,$3,$4)', [randomUUID(), organization, email, hash]);
    }
    const auth = createSessionAuth({ pool: runtime.pool, appBaseUrl: 'http://localhost:3000' });
    app = createSprint1App({ pool: runtime.pool, authenticate: auth.authenticate, authRouter: auth.router, sameOrigin: auth.sameOrigin });
  });
  afterAll(async () => { await runtime?.close(); });
  test('login, sincronizacion idempotente, conflicto, QR, aislamiento y logout', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: 'a@example.test', password });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(login.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect((await agent.get('/api/v1/auth/session')).body.identity.tenantId).toBe(tenant);
    const body = { sourceId: 'browser-test', events: [{ clientEventId: randomUUID(), eventType: 'LotRegistered', occurredAt: new Date().toISOString(), dependencies: [], payload: { mineralType: 'Gold', weight: '125.50', weightUnit: 'kg', originEvidence: { reference: 'REF-1', source: 'Declaracion' } } }] };
    const first = await agent.post('/api/v1/events/synchronize').send(body);
    expect(first.status).toBe(200);
    expect(first.body.results[0].status).toBe('Accepted');
    const lotId = first.body.results[0].lotId;
    const retry = await agent.post('/api/v1/events/synchronize').send(body);
    expect(retry.body.results[0]).toMatchObject({ status: 'AlreadyProcessed', lotId });
    body.events[0].payload.weight = '999';
    expect((await agent.post('/api/v1/events/synchronize').send(body)).body.results[0].status).toBe('Conflict');
    expect((await agent.get(`/api/v1/lots/${lotId}`)).body).toMatchObject({ status: 'Registered', originEvidenceStatus: 'PendingReview' });
    expect((await agent.get(`/api/v1/lots/${lotId}/qr`)).headers['content-type']).toMatch(/image\/png/);
    const other = request.agent(app);
    await other.post('/api/v1/auth/login').send({ email: 'b@example.test', password });
    expect((await other.get(`/api/v1/lots/${lotId}`)).status).toBe(404);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/v1/auth/session')).status).toBe(401);
    expect(Number((await runtime.pool.query('SELECT count(*) FROM mineral_lots')).rows[0].count)).toBe(1);
  });
  test('rechaza origen ajeno y bloquea tras tres intentos fallidos', async () => {
    expect((await request(app).post('/api/v1/auth/login').set('Origin', 'https://other.example').send({})).status).toBe(403);
    for (let i=0;i<3;i++) expect((await request(app).post('/api/v1/auth/login').send({email:'locked@example.test',password:'incorrect'})).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({email:'locked@example.test',password})).status).toBe(401);
  });
});
