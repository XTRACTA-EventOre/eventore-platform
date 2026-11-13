import 'dotenv/config';
import { createMySqlPool } from '../../shared/infrastructure/persistence/mysql.js';
import { createIdentityApp } from './app.js';

if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL');
const pool = createMySqlPool(process.env.DATABASE_URL);
const app = createIdentityApp({ pool,
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
  internalSecret: process.env.INTERNAL_AUTH_SECRET,
  secure: process.env.NODE_ENV === 'production' });
app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
