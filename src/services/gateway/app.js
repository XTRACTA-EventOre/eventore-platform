import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function createGatewayApp({ identityUrl, traceabilityUrl, fetchImpl = fetch, serveFrontend = true }) {
  if (!identityUrl || !traceabilityUrl) throw new Error('Configura IDENTITY_URL y TRACEABILITY_URL');
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));
  const proxy = target => async (req, res) => {
    try {
      const url = new URL(req.originalUrl, target);
      const headers = {};
      for (const name of ['content-type', 'cookie', 'origin', 'accept']) {
        if (req.headers[name]) headers[name] = req.headers[name];
      }
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : req;
      const upstream = await fetchImpl(url, { method: req.method, headers, body,
        duplex: body ? 'half' : undefined, redirect: 'manual', signal: AbortSignal.timeout(10000) });
      res.status(upstream.status);
      for (const name of ['content-type', 'cache-control', 'location']) {
        const value = upstream.headers.get(name); if (value) res.set(name, value);
      }
      const cookies = upstream.headers.getSetCookie?.() ?? [];
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.status(503).json({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } });
    }
  };
  app.use('/api/v1/auth', proxy(identityUrl));
  app.use(['/api/v1/lots', '/api/v1/events'], proxy(traceabilityUrl));
  app.use(['/api/v1/openapi.json', '/api/docs'], proxy(traceabilityUrl));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint inexistente' } }));
  if (serveFrontend) {
    const dist = fileURLToPath(new URL('../../../../frontend/dist/', import.meta.url));
    if (existsSync(dist)) {
      app.use(express.static(dist));
      app.get(['/', '/lots/:lotId'], (_req, res) => res.sendFile(`${dist}index.html`));
    }
  }
  return app;
}
