import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.API_BASE_URL ?? 'http://localhost:3000';
const password = process.env.SMOKE_PASSWORD;
if (!password) throw new Error('Configura SMOKE_PASSWORD');
async function call(path, { cookie, body, method = body ? 'POST' : 'GET', status = 200 } = {}) {
  const response = await fetch(new URL(path, base), { method,
    headers: { origin: process.env.APP_BASE_URL ?? 'http://localhost:5173',
      ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  const result = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`);
  return { result, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const admin = (await call('/api/v1/auth/login', { body: { email: 'admin-smoke@example.test', password } })).cookie;
const carrier = (await call('/api/v1/auth/login', { body: { email: 'carrier-smoke@example.test', password } })).cookie;
const input = () => ({ clientEventId: randomUUID(), mineralType: 'Gold', weight: '125.5', weightUnit: 'kg',
  originEvidence: { reference: 'SPRINT2-SMOKE', source: 'Prueba' } });
const cancelled = (await call('/api/v1/lots', { cookie: admin, body: input(), status: 201 })).result;
const cancelBody = { operationId: randomUUID(), expectedVersion: cancelled.version, reason: 'Registro de prueba duplicado' };
const first = (await call(`/api/v1/lots/${cancelled.lotId}/cancellation`, { cookie: admin, body: cancelBody })).result;
const replay = (await call(`/api/v1/lots/${cancelled.lotId}/cancellation`, { cookie: admin, body: cancelBody })).result;
assert.deepEqual(replay, first); assert.equal(first.status, 'Cancelled');
const lot = (await call('/api/v1/lots', { cookie: admin, body: input(), status: 201 })).result;
const handover = (await call(`/api/v1/lots/${lot.lotId}/handovers`, { cookie: admin,
  body: { operationId: randomUUID(), expectedVersion: lot.version, recipientUserId: null }, status: 201 })).result;
const acceptance = { operationId: randomUUID(), expectedVersion: handover.version, handoverId: handover.handoverId };
const accepted = (await call(`/api/v1/custody/lots/${lot.lotId}/accept`, { cookie: carrier, body: acceptance })).result;
assert.equal(accepted.status, 'InTransit');
assert.deepEqual((await call(`/api/v1/custody/lots/${lot.lotId}/accept`, { cookie: carrier, body: acceptance })).result, accepted);
assert.equal((await call(`/api/v1/custody/lots/${lot.lotId}`, { cookie: admin })).result.custody.operationId, acceptance.operationId);
await call(`/api/v1/lots/${lot.lotId}/cancellation`, { cookie: admin,
  body: { operationId: randomUUID(), expectedVersion: accepted.version, reason: 'Intento después de salida' }, status: 409 });
const users = (await call('/api/v1/auth/users', { cookie: admin })).result.users;
const operator = users.find(user => user.email === 'smoke@example.test');
assert.ok(operator);
await call(`/api/v1/auth/users/${operator.id}/roles`, { cookie: admin, method: 'PUT', body: { roles: ['Viewer'] } });
const operatorSession = (await call('/api/v1/auth/login', { body: { email: 'smoke@example.test', password } })).cookie;
await call('/api/v1/lots', { cookie: operatorSession, body: input(), status: 403 });
for (const cookie of [admin, carrier, operatorSession]) await call('/api/v1/auth/logout', { cookie, method: 'POST', status: 204 });
console.log('SPRINT2 SMOKE PASS: roles, cancelación auditada, entrega, Logistics, custodia idempotente y bloqueo de cancelación en tránsito');
