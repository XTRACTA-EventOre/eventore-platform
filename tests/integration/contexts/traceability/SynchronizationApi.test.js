import {
    describe,
    expect,
    jest,
    test
} from '@jest/globals';

import express from 'express';
import request from 'supertest';

import {
    SynchronizeEvents
} from '../../../../src/contexts/traceability/application/use-cases/SynchronizeEvents.js';

import {
    createSynchronizationRouter
} from '../../../../src/contexts/traceability/infrastructure/http/synchronization.routes.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

const clientEventId =
    '22222222-2222-4222-8222-222222222222';

const validBody = {
    sourceId: 'field-device-01',
    events: [{
        clientEventId,
        eventType: 'LotRegistered',
        occurredAt: '2026-10-08T12:00:00Z',
        dependencies: [],
        payload: {
            mineralType: 'Gold',
            weight: '125.50',
            weightUnit: 'kg',
            originEvidence: {
                reference: 'DOCUMENT-001',
                source: 'Mining operator declaration'
            }
        }
    }]
};

function authenticatedMiddleware(req, res, next) {
    req.identity = {
        tenantId,
        userId: 'supervisor-01'
    };

    next();
}

function unauthenticatedMiddleware(req, res, next) {
    next();
}

function createTestApp({
                           process,
                           authenticate = authenticatedMiddleware
                       }) {
    const app = express();

    app.use(express.json());

    const synchronizeEvents = new SynchronizeEvents({
        eventProcessor: { process }
    });

    app.use(
        '/api/v1/events',
        createSynchronizationRouter({
            synchronizeEvents,
            authenticate
        })
    );

    return app;
}

describe('Synchronization REST API', () => {
    test('returns 200 for a confirmed event', async () => {
        const app = createTestApp({
            process: jest.fn().mockResolvedValue({
                status: 'Accepted',
                lotId: '33333333-3333-4333-8333-333333333333'
            })
        });

        const response = await request(app)
            .post('/api/v1/events/synchronize')
            .send(validBody);

        expect(response.statusCode).toBe(200);

        expect(response.body.results[0].status).toBe(
            'Accepted'
        );
    });

    test('returns 400 for an invalid request', async () => {
        const process = jest.fn();

        const app = createTestApp({ process });

        const response = await request(app)
            .post('/api/v1/events/synchronize')
            .send({
                sourceId: 'field-device-01',
                events: []
            });

        expect(response.statusCode).toBe(400);

        expect(response.body.error.code).toBe(
            'INVALID_SYNC_REQUEST'
        );

        expect(process).not.toHaveBeenCalled();
    });

    test('returns 401 without authentication', async () => {
        const process = jest.fn();

        const app = createTestApp({
            process,
            authenticate: unauthenticatedMiddleware
        });

        const response = await request(app)
            .post('/api/v1/events/synchronize')
            .send(validBody);

        expect(response.statusCode).toBe(401);

        expect(process).not.toHaveBeenCalled();
    });

    test('returns 503 when processing is not confirmed', async () => {
        const app = createTestApp({
            process: jest.fn().mockRejectedValue(
                new Error('Storage unavailable')
            )
        });

        const response = await request(app)
            .post('/api/v1/events/synchronize')
            .send(validBody);

        expect(response.statusCode).toBe(503);

        expect(response.body.error.code).toBe(
            'SYNCHRONIZATION_NOT_CONFIRMED'
        );
    });
});