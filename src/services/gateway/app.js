import express from 'express';

export function createGatewayApp({ identityUrl, traceabilityUrl, logisticsUrl, fetchImpl = fetch, appBaseUrl = 'http://localhost:5173' }) {
  if (!identityUrl || !traceabilityUrl) throw new Error('Configura IDENTITY_URL y TRACEABILITY_URL');
  const app = express();
  app.disable('x-powered-by');
  const allowedOrigin = new URL(appBaseUrl).origin;
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== allowedOrigin) {
      return res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Origen no autorizado' } });
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', allowedOrigin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.vary('Origin');
    }
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    next();
  });
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
  app.use('/api/v1/custody', proxy(logisticsUrl));
  app.use(['/api/v1/lots', '/api/v1/events'], proxy(traceabilityUrl));
  app.use(['/api/v1/openapi.json', '/api/docs'], proxy(traceabilityUrl));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint inexistente' } }));
  return app;
}
