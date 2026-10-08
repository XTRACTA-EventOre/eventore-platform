import {
    describe,
    expect,
    jest,
    test
} from '@jest/globals';

import express from 'express';
import request from 'supertest';

import {
    GetMineralLotDetails
} from '../../../../src/contexts/traceability/application/use-cases/GetMineralLotDetails.js';

import {
    createLotLookupRouter
} from '../../../../src/contexts/traceability/infrastructure/http/lotLookup.routes.js';

const TENANT_ID =
    '11111111-1111-4111-8111-111111111111';

const LOT_ID =
    '22222222-2222-4222-8222-222222222222';

const LOT_ENDPOINT = `/api/v1/lots/${LOT_ID}`;

function createReadModel(overrides = {}) {
    return {
        id: LOT_ID,
        tenantId: TENANT_ID,
        mineralType: 'Gold',
        weight: '125.50',
        weightUnit: 'kg',
        status: 'Registered',
        version: 1,
        originEvidenceStatus: 'PendingReview',
        ...overrides
    };
}

function authenticatedMiddleware(req, res, next) {
    req.identity = {
        tenantId: TENANT_ID,
        userId: 'supervisor-01'
    };

    next();
}

function unauthenticatedMiddleware(req, res, next) {
    next();
}

function createTestApp({
                           findById,
                           authenticate = authenticatedMiddleware
                       }) {
    const app = express();

    app.disable('x-powered-by');
    app.use(express.json());

    const getMineralLotDetails = new GetMineralLotDetails({
        mineralLotReader: { findById }
    });

    app.use(
        '/api/v1/lots',
        createLotLookupRouter({
            getMineralLotDetails,
            authenticate
        })
    );

    return app;
}

describe('Mineral Lot Lookup API', () => {
    test('returns 200 for an existing lot', async () => {
        const app = createTestApp({
            findById: jest.fn().mockResolvedValue(
                createReadModel()
            )
        });

        const response = await request(app)
            .get(LOT_ENDPOINT);

        expect(response.statusCode).toBe(200);
        expect(response.body.lotId).toBe(LOT_ID);
        expect(response.body.status).toBe('Registered');
    });

    test('returns cancelled status for cancelled lots', async () => {
        const app = createTestApp({
            findById: jest.fn().mockResolvedValue(
                createReadModel({ status: 'Cancelled' })
            )
        });

        const response = await request(app)
            .get(LOT_ENDPOINT);

        expect(response.statusCode).toBe(200);
        expect(response.body.status).toBe('Cancelled');
        expect(response.body.transportStatus).toBe('Blocked');
    });

    test('returns 400 for an invalid lot identifier', async () => {
        const findById = jest.fn();

        const app = createTestApp({ findById });

        const response = await request(app)
            .get('/api/v1/lots/invalid-id');

        expect(response.statusCode).toBe(400);
        expect(response.body.error.code).toBe('INVALID_LOT_ID');
        expect(findById).not.toHaveBeenCalled();
    });

    test('returns 401 without authentication', async () => {
        const findById = jest.fn();

        const app = createTestApp({
            findById,
            authenticate: unauthenticatedMiddleware
        });

        const response = await request(app)
            .get(LOT_ENDPOINT);

        expect(response.statusCode).toBe(401);
        expect(findById).not.toHaveBeenCalled();
    });

    test('returns 404 when lot does not exist', async () => {
        const app = createTestApp({
            findById: jest.fn().mockResolvedValue(null)
        });

        const response = await request(app)
            .get(LOT_ENDPOINT);

        expect(response.statusCode).toBe(404);
        expect(response.body.error.code).toBe(
            'MINERAL_LOT_NOT_FOUND'
        );
    });

    test('does not disclose another tenant lot', async () => {
        const app = createTestApp({
            findById: jest.fn().mockResolvedValue(
                createReadModel({
                    tenantId:
                        '33333333-3333-4333-8333-333333333333'
                })
            )
        });

        const response = await request(app)
            .get(LOT_ENDPOINT);

        expect(response.statusCode).toBe(404);
    });

    test('returns 503 without leaking repository errors', async () => {
        const app = createTestApp({
            findById: jest.fn().mockRejectedValue(
                new Error('Sensitive database connection details')
            )
        });

        const response = await request(app)
            .get(LOT_ENDPOINT);

        expect(response.statusCode).toBe(503);
        expect(response.body.error.code).toBe(
            'LOT_LOOKUP_UNAVAILABLE'
        );

        expect(JSON.stringify(response.body)).not.toContain(
            'Sensitive database connection details'
        );
    });
});