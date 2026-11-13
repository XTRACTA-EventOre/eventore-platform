import 'dotenv/config';
import { createMySqlPool } from '../../shared/infrastructure/persistence/mysql.js';
import { createLogisticsApp } from './app.js';
const pool = createMySqlPool(process.env.DATABASE_URL);
createLogisticsApp({ pool, identityUrl: process.env.IDENTITY_URL, traceabilityUrl: process.env.TRACEABILITY_URL,
  internalSecret: process.env.INTERNAL_AUTH_SECRET, appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173' })
  .listen(Number(process.env.PORT ?? 3003), '0.0.0.0');
