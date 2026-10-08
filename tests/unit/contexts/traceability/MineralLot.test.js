import {
    describe,
    test,
    expect
} from '@jest/globals';

import {
    MineralLot,
    DomainError,
    LotStatus,
    EvidenceReviewStatus,
    TraceEventType
} from '../../../../src/contexts/traceability/domain/index.js';

const validRegistration = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',

    mineralType: 'Gold',
    weight: '125.50',
    weightUnit: 'kg',

    originEvidence: {
        id: '33333333-3333-4333-8333-333333333333',
        reference: 'DOCUMENT-001',
        source: 'Mining operator declaration'
    },

    traceEventId: '44444444-4444-4444-8444-444444444444',
    clientEventId: '55555555-5555-4555-8555-555555555555',

    sourceId: 'field-device-01',
    occurredAt: '2026-10-08T01:00:00.000Z'
};

function createLot(overrides = {}) {
    return MineralLot.register({
        ...validRegistration,
        ...overrides
    });
}

describe('MineralLot Aggregate', () => {
    test('should register a valid mineral lot', () => {
        const lot = createLot();

        expect(lot.id).toBe(validRegistration.id);

        expect(lot.status).toBe(
            LotStatus.REGISTERED
        );

        expect(lot.version).toBe(1);

        expect(lot.mineralType.value).toBe('Gold');

        expect(lot.mineralWeight.amount).toBe('125.50');
        expect(lot.mineralWeight.unit).toBe('kg');
    });

    test('should create initial origin evidence', () => {
        const lot = createLot();

        expect(lot.originEvidence.reviewStatus).toBe(
            EvidenceReviewStatus.PENDING_REVIEW
        );

        expect(lot.originEvidence.lotId).toBe(lot.id);

        expect(lot.originEvidence.reference).toBe(
            'DOCUMENT-001'
        );
    });

    test('should create the initial trace event', () => {
        const lot = createLot();

        expect(lot.traceEvents).toHaveLength(1);

        const event = lot.traceEvents[0];

        expect(event.eventType).toBe(
            TraceEventType.LOT_REGISTERED
        );

        expect(event.clientEventId).toBe(
            validRegistration.clientEventId
        );
    });

    test.each([
        ['0'],
        ['0.000'],
        ['-5'],
        ['invalid'],
        ['']
    ])('should reject invalid weight %s', (weight) => {
        expect(() => createLot({ weight }))
            .toThrow(DomainError);
    });

    test('should reject unsupported weight units', () => {
        expect(() => createLot({
            weightUnit: 'unknown'
        })).toThrow(DomainError);
    });

    test('should reject empty mineral type', () => {
        expect(() => createLot({
            mineralType: '   '
        })).toThrow(DomainError);
    });

    test('should require origin evidence', () => {
        expect(() => createLot({
            originEvidence: null
        })).toThrow(DomainError);
    });

    test('should reject incomplete origin evidence', () => {
        expect(() => createLot({
            originEvidence: {
                id: validRegistration.originEvidence.id,
                reference: '',
                source: ''
            }
        })).toThrow(DomainError);
    });

    test('should reject an invalid tenant ID', () => {
        expect(() => createLot({
            tenantId: 'invalid-tenant'
        })).toThrow(DomainError);
    });

    test('should reject an invalid client event ID', () => {
        expect(() => createLot({
            clientEventId: 'invalid-event'
        })).toThrow(DomainError);
    });

    test('should reject invalid timestamps', () => {
        expect(() => createLot({
            occurredAt: 'not-a-date'
        })).toThrow(DomainError);
    });

    test('should protect internal data from snapshot changes', () => {
        const lot = createLot();

        const snapshot = lot.toPrimitives();

        snapshot.originEvidence.reference = 'MODIFIED';
        snapshot.traceEvents[0].payload.weight = '999';

        const currentState = lot.toPrimitives();

        expect(currentState.originEvidence.reference).toBe(
            'DOCUMENT-001'
        );

        expect(currentState.traceEvents[0].payload.weight).toBe(
            '125.50'
        );
    });

    test('should prevent mutation of trace event collection', () => {
        const lot = createLot();

        const events = lot.traceEvents;

        events.pop();

        expect(lot.traceEvents).toHaveLength(1);
    });
});