import express from 'express';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';
import { createAccessRouter } from './access.js';
import { requirePermission } from '../../shared/infrastructure/http/permissions.js';

export function createIdentityApp({ pool, appBaseUrl, internalSecret, secure = false }) {
  if (!internalSecret) throw new Error('Configura INTERNAL_AUTH_SECRET');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  const auth = createSessionAuth({ pool, appBaseUrl, secure });
  app.use(auth.sameOrigin);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'identity' }));
  app.use('/api/v1/auth', auth.router);
  app.use('/api/v1/auth', createAccessRouter({ pool, authenticate: auth.authenticate }));
  app.get('/internal/session', (req, res, next) => {
    if (req.get('x-internal-secret') !== internalSecret) return res.status(403).end();
    return auth.authenticate(req, res, next);
  }, (req, res) => res.json({ identity: req.identity }));
  app.get('/internal/transporters/:userId', (req, res, next) => {
    if (req.get('x-internal-secret') !== internalSecret) return res.status(403).end();
    return auth.authenticate(req, res, next);
  }, requirePermission('lots.release'), async (req, res) => {
    try {
      const [rows] = await pool.execute(`SELECT u.id FROM app_users u JOIN app_user_roles r ON r.user_id=u.id
        WHERE u.id=? AND u.tenant_id=? AND u.active=true AND r.role_name='Transporter'`, [req.params.userId, req.identity.tenantId]);
      if (!rows.length) return res.status(404).json({ error: { code: 'TRANSPORTER_NOT_FOUND', message: 'Transportista no disponible' } });
      res.json({ userId: rows[0].id });
    } catch { res.status(503).json({ error: { code: 'ACCESS_UNAVAILABLE', message: 'No se pudo verificar al transportista' } }); }
  });
  return app;
}
