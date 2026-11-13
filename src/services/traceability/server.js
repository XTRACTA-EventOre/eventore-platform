import 'dotenv/config';
import pg from 'pg';
import { createTraceabilityApp } from './app.js';

if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = createTraceabilityApp({ pool,
  identityUrl: process.env.IDENTITY_URL,
  internalSecret: process.env.INTERNAL_AUTH_SECRET,
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000' });
app.listen(Number(process.env.PORT ?? 3002), '0.0.0.0');
