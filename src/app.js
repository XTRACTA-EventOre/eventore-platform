import 'dotenv/config';
import { createMySqlPool } from './shared/infrastructure/persistence/mysql.js';
import { createSprint1App } from './contexts/traceability/infrastructure/bootstrap/createSprint1App.js';
import { createSessionAuth } from './shared/infrastructure/http/sessionAuth.js';
import { fileURLToPath } from 'node:url';

const pool = process.env.DATABASE_URL
    ? createMySqlPool(process.env.DATABASE_URL) : null;
const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173';
const auth = createSessionAuth({ pool, appBaseUrl, secure: process.env.NODE_ENV === 'production' });
const app = createSprint1App({ pool, appBaseUrl, authenticate: auth.authenticate,
    authRouter: auth.router, sameOrigin: auth.sameOrigin });
app.get('/api/v1/openapi.json', (_req,res) => res.sendFile(fileURLToPath(new URL('../docs/openapi.json', import.meta.url))));
app.get('/api/docs', (_req,res) => res.type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>EventOre API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#swagger-ui'});</script></body></html>`));
app.use('/api', (_req,res) => res.status(404).json({ error: { code:'NOT_FOUND',message:'Endpoint inexistente' } }));

export { app, pool };
