import 'dotenv/config';
import {detectDelays} from './tracking.js';
import { createMySqlPool } from '../../shared/infrastructure/persistence/mysql.js';
import { createLogisticsApp } from './app.js';
const pool = createMySqlPool(process.env.DATABASE_URL);
setInterval(()=>detectDelays(pool).catch(()=>console.error('Seguimiento de demoras pendiente')),30000).unref();
createLogisticsApp({ pool, identityUrl: process.env.IDENTITY_URL, traceabilityUrl: process.env.TRACEABILITY_URL,
  internalSecret: process.env.INTERNAL_AUTH_SECRET, appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173' })
  .listen(Number(process.env.PORT ?? 3003), '0.0.0.0');
