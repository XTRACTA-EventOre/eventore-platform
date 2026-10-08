import {
    describe,
    expect,
    jest,
    test
} from '@jest/globals';

import {
    SynchronizeEvents
} from '../../../../src/contexts/traceability/application/use-cases/SynchronizeEvents.js';

const tenantId = '11111111-1111-4111-8111-111111111111';

const clientEventId =
    '22222222-2222-4222-8222-222222222222';

const lotId = '33333333-3333-4333-8333-333333333333';

const validEvent = {
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
};

function createRequest(events = [validEvent]) {
    return {
        tenantId,
        actorId: 'supervisor-01',
        sourceId: 'field-device-01',
        events
    };
}

describe('SynchronizeEvents', () => {
    test('returns confirmed processing results', async () => {
        const process = jest.fn().mockResolvedValue({
            status: 'Accepted',
            lotId
        });

        const useCase = new SynchronizeEvents({
            eventProcessor: { process }
        });

        const result = await useCase.execute(createRequest());

        expect(result).toEqual({
            results: [{
                clientEventId,
                status: 'Accepted',
                reason: null,
                lotId
            }]
        });

        expect(process).toHaveBeenCalledWith({
            tenantId,
            actorId: 'supervisor-01',
            sourceId: 'field-device-01',
            event: validEvent
        });
    });

    test('preserves AlreadyProcessed result', async () => {
        const useCase = new SynchronizeEvents({
            eventProcessor: {
                process: jest.fn().mockResolvedValue({
                    status: 'AlreadyProcessed',
                    lotId
                })
            }
        });

        const result = await useCase.execute(createRequest());

        expect(result.results[0].status).toBe(
            'AlreadyProcessed'
        );
    });

    test('rejects an empty event collection', async () => {
        const process = jest.fn();

        const useCase = new SynchronizeEvents({
            eventProcessor: { process }
        });

        await expect(
            useCase.execute(createRequest([]))
        ).rejects.toThrow('At least one event is required');

        expect(process).not.toHaveBeenCalled();
    });

    test('validates all events before processing', async () => {
        const process = jest.fn();

        const useCase = new SynchronizeEvents({
            eventProcessor: { process }
        });

        await expect(
            useCase.execute(createRequest([
                validEvent,
                {
                    ...validEvent,
                    clientEventId: 'invalid-uuid'
                }
            ]))
        ).rejects.toThrow();

        expect(process).not.toHaveBeenCalled();
    });

    test('does not invent acceptance after a failure', async () => {
        const useCase = new SynchronizeEvents({
            eventProcessor: {
                process: jest.fn().mockRejectedValue(
                    new Error('Database unavailable')
                )
            }
        });

        await expect(
            useCase.execute(createRequest())
        ).rejects.toThrow('Database unavailable');
    });

    test('rejects unexpected processor results', async () => {
        const useCase = new SynchronizeEvents({
            eventProcessor: {
                process: jest.fn().mockResolvedValue({
                    status: 'Unknown'
                })
            }
        });

        await expect(
            useCase.execute(createRequest())
        ).rejects.toThrow(
            'EventProcessor returned an invalid result'
        );
    });
});