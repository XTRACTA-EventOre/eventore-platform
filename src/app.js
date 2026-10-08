import express from 'express';
import { healthRouter } from './shared/infrastructure/http/health.routes.js';

const app = express();

app.disable('x-powered-by');

app.use(express.json());

app.use('/api/v1/health', healthRouter);

export { app };