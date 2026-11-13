import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import { createGatewayApp } from '../src/services/gateway/app.js';

describe('independent frontend origin', () => {
  const options = { identityUrl: 'http://identity:3001', traceabilityUrl: 'http://traceability:3002',
    appBaseUrl: 'http://localhost:5173' };
  test('allows credentialed requests and preflight only from the configured frontend', async () => {
    const app = createGatewayApp(options);
    const allowed = await request(app).options('/api/v1/auth/login').set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(allowed.headers.vary).toContain('Origin');
    const denied = await request(app).post('/api/v1/auth/login').set('Origin', 'https://untrusted.example');
    expect(denied.status).toBe(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
  test('remains API-only and supports non-browser clients', async () => {
    const app = createGatewayApp(options);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get('/lots/abc')).status).toBe(404);
    expect((await request(app).get('/')).status).toBe(404);
  });
});
