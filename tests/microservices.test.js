import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createGatewayApp } from '../src/services/gateway/app.js';
import { createRemoteAuth } from '../src/services/traceability/remoteAuth.js';
import { createIdentityApp } from '../src/services/identity/app.js';

describe('separate service boundaries', () => {
  test('gateway sends requests to their owner and preserves session cookies and binary QR', async () => {
    const calls = [];
    const gateway = createGatewayApp({ identityUrl: 'http://identity:3001',
      traceabilityUrl: 'http://traceability:3002',
      fetchImpl: async (url, options) => {
        calls.push({ url: String(url), cookie: options.headers.cookie });
        if (String(url).includes('/auth/')) return new Response('{}', {
          headers: { 'set-cookie': 'eventore_session=test; HttpOnly', 'content-type': 'application/json' }
        });
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { 'content-type': 'image/png' }
        });
      } });
    const login = await request(gateway).post('/api/v1/auth/login').send({});
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    const qr = await request(gateway).get('/api/v1/lots/abc/qr').set('Cookie', 'eventore_session=test');
    expect(qr.headers['content-type']).toMatch(/image\/png/);
    expect(calls).toEqual([
      { url: 'http://identity:3001/api/v1/auth/login', cookie: undefined },
      { url: 'http://traceability:3002/api/v1/lots/abc/qr', cookie: 'eventore_session=test' }
    ]);
  });

  test('traceability asks identity for each request and fails closed', async () => {
    let status = 200;
    const authenticate = createRemoteAuth({ identityUrl: 'http://identity:3001', internalSecret: 'test-secret',
      fetchImpl: async (_url, options) => {
        expect(options.headers['x-internal-secret']).toBe('test-secret');
        expect(options.headers.cookie).toBe('eventore_session=test');
        return new Response(status === 200 ? JSON.stringify({ identity: { tenantId: 'tenant-1', userId: 'user-1', permissions: ['lots.read'] } }) : '{}', { status });
      } });
    const app = express();
    app.get('/protected', authenticate, (req, res) => res.json(req.identity));
    expect((await request(app).get('/protected').set('Cookie', 'eventore_session=test')).body.tenantId).toBe('tenant-1');
    status = 401;
    expect((await request(app).get('/protected').set('Cookie', 'eventore_session=test')).status).toBe(401);
    status = 503;
    expect((await request(app).get('/protected').set('Cookie', 'eventore_session=test')).status).toBe(503);
  });

  test('internal session endpoint requires a shared secret', async () => {
    const app = createIdentityApp({ pool: null, appBaseUrl: 'http://localhost:3000', internalSecret: 'test-secret' });
    expect((await request(app).get('/internal/session')).status).toBe(403);
  });
});
