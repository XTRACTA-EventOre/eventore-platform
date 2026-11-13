import express from 'express';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';

export function createIdentityApp({ pool, appBaseUrl, internalSecret, secure = false }) {
  if (!internalSecret) throw new Error('Configura INTERNAL_AUTH_SECRET');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  const auth = createSessionAuth({ pool, appBaseUrl, secure });
  app.use(auth.sameOrigin);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'identity' }));
  app.use('/api/v1/auth', auth.router);
  app.get('/internal/session', (req, res, next) => {
    if (req.get('x-internal-secret') !== internalSecret) return res.status(403).end();
    return auth.authenticate(req, res, next);
  }, (req, res) => res.json({ identity: req.identity }));
  return app;
}
