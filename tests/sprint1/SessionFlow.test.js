import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { makeMySqlRuntime } from './breithner/mysqlFixture.js';
import { createSessionAuth, hashPassword } from '../../src/shared/infrastructure/http/sessionAuth.js';
import { createSprint1App } from '../../src/contexts/traceability/infrastructure/bootstrap/createSprint1App.js';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('Sesion real y flujo integrado MySQL', () => {
  let runtime, app;
  const tenant = randomUUID(), password = 'Sprint1-test-password';
  beforeAll(async () => {
    runtime = await makeMySqlRuntime();
    const hash = await hashPassword(password);
    for (const [email, organization] of [['a@example.test', tenant], ['b@example.test', randomUUID()], ['locked@example.test', tenant]]) {
      await runtime.pool.query('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES(?,?,?,?)', [randomUUID(), organization, email, hash]);
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
    expect(Number((await runtime.pool.query('SELECT count(*) AS n FROM mineral_lots'))[0][0].n)).toBe(1);
  });
  test('rechaza origen ajeno y bloquea tras tres intentos fallidos', async () => {
    expect((await request(app).post('/api/v1/auth/login').set('Origin', 'https://other.example').send({})).status).toBe(403);
    for (let i=0;i<3;i++) expect((await request(app).post('/api/v1/auth/login').send({email:'locked@example.test',password:'incorrect'})).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({email:'locked@example.test',password})).status).toBe(401);
  });
  test('un bloqueo vencido reinicia el contador y permite autenticarse', async () => {
    await runtime.pool.execute('UPDATE app_users SET failed_attempts=3,locked_until=? WHERE email=?',
      [new Date(Date.now() - 60000), 'locked@example.test']);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'locked@example.test', password: 'incorrect' })).status).toBe(401);
    const [[user]] = await runtime.pool.execute('SELECT failed_attempts,locked_until FROM app_users WHERE email=?', ['locked@example.test']);
    expect(user.failed_attempts).toBe(1);
    expect(user.locked_until).toBeNull();
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'locked@example.test', password })).status).toBe(200);
  });
  test('rechaza una sesión vencida en MySQL', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/v1/auth/login').send({ email: 'a@example.test', password })).status).toBe(200);
    await runtime.pool.execute('UPDATE app_sessions SET expires_at=?', [new Date(Date.now() - 60000)]);
    expect((await agent.get('/api/v1/auth/session')).status).toBe(401);
  });
});
