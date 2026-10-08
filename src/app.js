import 'dotenv/config';
import pg from 'pg';
import { createSprint1App } from './contexts/traceability/infrastructure/bootstrap/createSprint1App.js';

const pool = process.env.DATABASE_URL
    ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;
const app = createSprint1App({ pool,
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173' });

export { app };
