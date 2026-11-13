import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { makeMySqlRuntime } from './sprint1/breithner/mysqlFixture.js';
import { hashPassword } from '../src/shared/infrastructure/http/sessionAuth.js';
import { createIdentityApp } from '../src/services/identity/app.js';
import { createTraceabilityApp } from '../src/services/traceability/app.js';
import { createLogisticsApp } from '../src/services/logistics/app.js';
import { createGatewayApp } from '../src/services/gateway/app.js';
import { payload } from './sprint1/breithner/fixtures.js';

jest.setTimeout(30000);
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('US05, US18 and US19 across independent MySQL services', () => {
  const tenant = randomUUID(), foreignTenant = randomUUID(), password = 'Sprint2-test-password', secret = 'test-internal-service-secret';
  const users = {}, cookies = {}, servers = [];
  let identity, traceability, logistics, gateway, dropAcceptanceResponse = false;
  async function start(app) {
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    servers.push(server); return `http://127.0.0.1:${server.address().port}`;
  }
  const call = (method, path, cookie) => request(gateway)[method](path).set('Cookie', cookie);
  const register = async () => {
    const response = await call('post', '/api/v1/lots', cookies.supervisor).send({ clientEventId: randomUUID(), ...payload });
    expect(response.status).toBe(201); return response.body;
  };
  const prepare = async lot => {
    const response = await call('post', `/api/v1/lots/${lot.lotId}/handovers`, cookies.supervisor)
      .send({ operationId: randomUUID(), expectedVersion: lot.version, recipientUserId: null });
    expect(response.status).toBe(201); return response.body;
  };
  const acceptBody = handover => ({ operationId: randomUUID(), expectedVersion: handover.version, handoverId: handover.handoverId });

  beforeAll(async () => {
    identity = await makeMySqlRuntime({ service: 'identity' });
    traceability = await makeMySqlRuntime({ service: 'traceability' });
    logistics = await makeMySqlRuntime({ service: 'logistics' });
    const hash = await hashPassword(password);
    for (const [name, role, owner] of [['admin','Administrator',tenant], ['supervisor','Supervisor',tenant],
      ['operator','Operator',tenant], ['carrierA','Transporter',tenant], ['carrierB','Transporter',tenant],
      ['foreign','Supervisor',foreignTenant]]) {
      const id = randomUUID(); users[name] = id;
      await identity.pool.execute('INSERT INTO app_users(id,tenant_id,email,password_hash) VALUES(?,?,?,?)', [id, owner, `${name}@example.test`, hash]);
      await identity.pool.execute('INSERT INTO app_user_roles(user_id,role_name) VALUES(?,?)', [id, role]);
    }
    const identityUrl = await start(createIdentityApp({ pool: identity.pool, appBaseUrl: 'http://localhost:4173', internalSecret: secret }));
    const traceabilityUrl = await start(createTraceabilityApp({ pool: traceability.pool, identityUrl, internalSecret: secret, appBaseUrl: 'http://localhost:4173' }));
    const logisticsUrl = await start(createLogisticsApp({ pool: logistics.pool, identityUrl, traceabilityUrl,
      internalSecret: secret, appBaseUrl: 'http://localhost:4173', fetchImpl: async (url, options) => {
        const response = await fetch(url, options);
        if (dropAcceptanceResponse && String(url).endsWith('/custody-accept')) {
          dropAcceptanceResponse = false; throw new Error('Simulated lost response after commit');
        }
        return response;
      } }));
    gateway = createGatewayApp({ identityUrl, traceabilityUrl, logisticsUrl, appBaseUrl: 'http://localhost:4173' });
    for (const name of Object.keys(users)) {
      const response = await request(gateway).post('/api/v1/auth/login').send({ email: `${name}@example.test`, password });
      expect(response.status).toBe(200); cookies[name] = response.headers['set-cookie'][0].split(';')[0];
    }
  });
  afterAll(async () => {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    await Promise.all([identity?.close(), traceability?.close(), logistics?.close()]);
  });

  test('US05: operator is denied administration; a role change applies to the same session immediately', async () => {
    expect((await call('get', '/api/v1/auth/users', cookies.operator)).status).toBe(403);
    const changed = await call('put', `/api/v1/auth/users/${users.operator}/roles`, cookies.admin).send({ roles: ['Viewer'] });
    expect(changed.status).toBe(200);
    const profile = await call('get', '/api/v1/auth/session', cookies.operator);
    expect(profile.body.identity.permissions).toEqual(['lots.read']);
    expect((await call('post', '/api/v1/lots', cookies.operator).send({ clientEventId: randomUUID(), ...payload })).status).toBe(403);
    expect((await call('post', '/api/v1/events/synchronize', cookies.operator).send({})).status).toBe(403);
    const [[audit]] = await identity.pool.execute('SELECT actor_id,assigned_roles FROM access_audit WHERE target_user_id=?', [users.operator]);
    expect(audit.actor_id).toBe(users.admin); expect(audit.assigned_roles).toEqual(['Viewer']);
  });

  test('US05: cross-tenant assignment, invalid roles and removal of the last administrator are rejected', async () => {
    expect((await call('put', `/api/v1/auth/users/${users.foreign}/roles`, cookies.admin).send({ roles: ['Administrator'] })).status).toBe(404);
    expect((await call('put', `/api/v1/auth/users/${users.admin}/roles`, cookies.admin).send({ roles: ['Operator'] })).status).toBe(409);
    expect((await call('put', `/api/v1/auth/users/${users.operator}/roles`, cookies.admin).send({ roles: ['Unknown'] })).status).toBe(400);
    const list = await call('get', '/api/v1/auth/users', cookies.admin);
    expect(list.status).toBe(200); expect(list.body.users.some(user => user.id === users.foreign)).toBe(false);
    expect(JSON.stringify(list.body)).not.toContain('password_hash');
  });

  test('US18: cancellation preserves actor, reason and date; identical retries have one effect', async () => {
    const lot = await register(), body = { operationId: randomUUID(), expectedVersion: 1, reason: 'Registro duplicado por error' };
    const path = `/api/v1/lots/${lot.lotId}/cancellation`;
    expect((await call('post', path, cookies.operator).send(body)).status).toBe(403);
    expect((await call('post', path, cookies.foreign).send(body)).status).toBe(404);
    const first = await call('post', path, cookies.supervisor).send(body);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ status: 'Cancelled', version: 2, actorId: users.supervisor, reason: body.reason });
    expect(Number.isNaN(Date.parse(first.body.occurredAt))).toBe(false);
    expect((await call('post', path, cookies.supervisor).send(body)).body).toEqual(first.body);
    expect((await call('post', path, cookies.supervisor).send({ ...body, reason: 'Otro motivo' })).status).toBe(409);
    const history = await call('get', `/api/v1/lots/${lot.lotId}/operations`, cookies.supervisor);
    expect(history.body.history).toHaveLength(1);
    expect((await call('get', `/api/v1/lots/${lot.lotId}/qr`, cookies.supervisor)).status).toBe(409);
    expect((await call('post', `/api/v1/custody/lots/${lot.lotId}/accept`, cookies.carrierA)
      .send({ operationId: randomUUID(), expectedVersion: 2, handoverId: randomUUID() })).status).toBe(409);
  });

  test('US19: two valid concurrent acceptances consolidate exactly one custody', async () => {
    const lot = await register(), handover = await prepare(lot);
    const bodies = [acceptBody(handover), acceptBody(handover)], carriers = [cookies.carrierA, cookies.carrierB];
    const path = `/api/v1/custody/lots/${lot.lotId}/accept`;
    const results = await Promise.all(bodies.map((body, index) => call('post', path, carriers[index]).send(body)));
    expect(results.map(result => result.status).sort()).toEqual([200,409]);
    const winner = results.findIndex(result => result.status === 200);
    const retried = await call('post', path, carriers[winner]).send(bodies[winner]);
    expect(retried.status).toBe(200); expect(retried.body).toEqual(results[winner].body);
    const current = await call('get', `/api/v1/lots/${lot.lotId}`, cookies.supervisor);
    expect(current.body).toMatchObject({ status: 'InTransit', version: 3, transportStatus: 'InTransit' });
    const custody = await call('get', `/api/v1/custody/lots/${lot.lotId}`, cookies.supervisor);
    expect(custody.body.custody.custodianUserId).toBe([users.carrierA, users.carrierB][winner]);
    expect((await call('post', `/api/v1/lots/${lot.lotId}/cancellation`, cookies.supervisor)
      .send({ operationId: randomUUID(), expectedVersion: 3, reason: 'Intento posterior a salida' })).status).toBe(409);
    const [[{ n }]] = await traceability.pool.execute("SELECT COUNT(*) AS n FROM lot_lifecycle_events WHERE lot_id=? AND action='CustodyAccepted'", [lot.lotId]);
    expect(Number(n)).toBe(1);
  });

  test('US19: restriction, expired delivery and unauthorized recipient are rejected', async () => {
    const restricted = await register(), delivery = await prepare(restricted);
    await traceability.pool.execute('INSERT INTO lot_restrictions(id,tenant_id,lot_id,reason) VALUES(?,?,?,?)', [randomUUID(), tenant, restricted.lotId, 'Cuarentena operativa']);
    const denied = await call('post', `/api/v1/custody/lots/${restricted.lotId}/accept`, cookies.carrierA).send(acceptBody(delivery));
    expect(denied.status).toBe(409); expect(denied.body.error.code).toBe('TRANSFER_RESTRICTED');
    const expired = await register(), expiredDelivery = await prepare(expired);
    await traceability.pool.execute('UPDATE lot_handovers SET expires_at=? WHERE id=?', [new Date(Date.now() - 60000), expiredDelivery.handoverId]);
    expect((await call('post', `/api/v1/custody/lots/${expired.lotId}/accept`, cookies.carrierA).send(acceptBody(expiredDelivery))).status).toBe(409);
    const assigned = await register();
    expect((await call('post', `/api/v1/lots/${assigned.lotId}/handovers`, cookies.supervisor)
      .send({ operationId: randomUUID(), expectedVersion: 1, recipientUserId: users.foreign })).status).toBe(400);
    const valid = await call('post', `/api/v1/lots/${assigned.lotId}/handovers`, cookies.supervisor)
      .send({ operationId: randomUUID(), expectedVersion: 1, recipientUserId: users.carrierA });
    expect(valid.status).toBe(201);
    expect((await call('post', `/api/v1/custody/lots/${assigned.lotId}/accept`, cookies.carrierB).send(acceptBody(valid.body))).status).toBe(403);
    expect((await call('post', `/api/v1/custody/lots/${assigned.lotId}/accept`, cookies.operator).send(acceptBody(valid.body))).status).toBe(403);
  });

  test('US19: a lost response after traceability commit is reconciled from durable state', async () => {
    const lot = await register(), delivery = await prepare(lot), body = acceptBody(delivery);
    dropAcceptanceResponse = true;
    const path = `/api/v1/custody/lots/${lot.lotId}/accept`;
    expect((await call('post', path, cookies.carrierA).send(body)).status).toBe(503);
    const [[pending]] = await logistics.pool.execute('SELECT state FROM custody_operations WHERE tenant_id=? AND operation_id=?', [tenant, body.operationId]);
    expect(pending.state).toBe('Pending');
    const confirmed = await call('get', `/api/v1/custody/lots/${lot.lotId}`, cookies.carrierA);
    expect(confirmed.status).toBe(200); expect(confirmed.body.pending).toEqual([]);
    expect(confirmed.body.custody).toMatchObject({ operationId: body.operationId, status: 'InTransit' });
    expect((await call('post', path, cookies.carrierA).send(body)).body).toEqual(confirmed.body.custody);
  });

  test('US18/US19: cancellation racing acceptance cannot produce both transitions', async () => {
    const lot = await register(), handover = await prepare(lot);
    const results = await Promise.all([
      call('post', `/api/v1/lots/${lot.lotId}/cancellation`, cookies.supervisor)
        .send({ operationId: randomUUID(), expectedVersion: handover.version, reason: 'Error antes de salida' }),
      call('post', `/api/v1/custody/lots/${lot.lotId}/accept`, cookies.carrierA).send(acceptBody(handover))
    ]);
    expect(results.map(result => result.status).sort()).toEqual([200,409]);
    const [[{ n }]] = await traceability.pool.execute("SELECT COUNT(*) AS n FROM lot_lifecycle_events WHERE lot_id=? AND action IN ('Cancelled','CustodyAccepted')", [lot.lotId]);
    expect(Number(n)).toBe(1);
  });

  test('each service database contains only its owned tables', async () => {
    for (const [runtime, present, absent] of [[identity, 'app_users', 'mineral_lots'],
      [traceability, 'mineral_lots', 'app_users'], [logistics, 'custody_operations', 'mineral_lots']]) {
      const [rows] = await runtime.pool.query('SHOW TABLES'); const names = rows.flatMap(row => Object.values(row));
      expect(names).toContain(present); expect(names).not.toContain(absent);
    }
  });
});
