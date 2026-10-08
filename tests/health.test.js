import { describe, test, expect } from '@jest/globals';
import request from 'supertest';

import { app } from '../src/app.js';

describe('Health API', () => {
    test('should return a healthy status', async () => {
        const response = await request(app)
            .get('/api/v1/health');

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            status: 'ok',
            service: 'eventore-api'
        });
    });

    test('should return 404 for an unknown route', async () => {
        const response = await request(app)
            .get('/api/v1/unknown');

        expect(response.statusCode).toBe(404);
    });
});