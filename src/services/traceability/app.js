import { createSprint1App } from '../../contexts/traceability/infrastructure/bootstrap/createSprint1App.js';
import { createSessionAuth } from '../../shared/infrastructure/http/sessionAuth.js';
import { createRemoteAuth } from './remoteAuth.js';
import { fileURLToPath } from 'node:url';

export function createTraceabilityApp({ pool, identityUrl, internalSecret, appBaseUrl }) {
  const authenticate = createRemoteAuth({ identityUrl, internalSecret });
  const { sameOrigin } = createSessionAuth({ pool: null, appBaseUrl });
  const app = createSprint1App({ pool, authenticate, sameOrigin, appBaseUrl });
  app.get('/api/v1/openapi.json', (_req, res) => res.sendFile(fileURLToPath(new URL('../../../docs/openapi.json', import.meta.url))));
  app.get('/api/docs', (_req, res) => res.type('html').send('<!doctype html><title>EventOre API</title><div id="swagger-ui"></div><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"><script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:"/api/v1/openapi.json",dom_id:"#swagger-ui"})</script>'));
  return app;
}
