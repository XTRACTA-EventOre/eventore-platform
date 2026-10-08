import {
    describe,
    expect,
    test
} from '@jest/globals';

import {
    EventConflictDecision
} from '../../../../src/contexts/traceability/domain/constants/EventConflictDecision.js';

import {
    InvalidEventComparisonError
} from '../../../../src/contexts/traceability/domain/errors/InvalidEventComparisonError.js';

import {
    EventConflictPolicy
} from '../../../../src/contexts/traceability/domain/services/EventConflictPolicy.js';

const TENANT_ID =
    '11111111-1111-4111-8111-111111111111';

const EVENT_ID =
    '22222222-2222-4222-8222-222222222222';

const DEPENDENCY_A =
    '33333333-3333-4333-8333-333333333333';

const DEPENDENCY_B =
    '44444444-4444-4444-8444-444444444444';

function createEvent() {
    return {
        tenantId: TENANT_ID,
        clientEventId: EVENT_ID,
        sourceId: 'field-device-01',
        eventType: 'LotRegistered',
        occurredAt: '2026-10-08T12:00:00Z',
        dependencies: [DEPENDENCY_A, DEPENDENCY_B],
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
}

const policy = new EventConflictPolicy();

describe('EventConflictPolicy', () => {
    test('identifies a new event', () => {
        const decision = policy.evaluate({
            incomingEvent: createEvent(),
            existingEvent: null
        });

        expect(decision).toBe(EventConflictDecision.NEW);
    });

    test('identifies an identical replay', () => {
        const decision = policy.evaluate({
            incomingEvent: createEvent(),
            existingEvent: createEvent()
        });

        expect(decision).toBe(EventConflictDecision.REPLAY);
    });

    test('ignores JSON property and dependency ordering', () => {
        const incoming = createEvent();

        incoming.dependencies.reverse();

        incoming.payload = {
            originEvidence: {
                source: 'Mining operator declaration',
                reference: 'DOCUMENT-001'
            },
            weightUnit: 'kg',
            weight: '125.50',
            mineralType: 'Gold'
        };

        const decision = policy.evaluate({
            incomingEvent: incoming,
            existingEvent: createEvent()
        });

        expect(decision).toBe(EventConflictDecision.REPLAY);
    });

    test('recognizes equivalent timestamps', () => {
        const incoming = createEvent();

        incoming.occurredAt = '2026-10-08T07:00:00-05:00';

        const decision = policy.evaluate({
            incomingEvent: incoming,
            existingEvent: createEvent()
        });

        expect(decision).toBe(EventConflictDecision.REPLAY);
    });

    test('detects changed mineral weight', () => {
        const incoming = createEvent();

        incoming.payload.weight = '999.50';

        const decision = policy.evaluate({
            incomingEvent: incoming,
            existingEvent: createEvent()
        });

        expect(decision).toBe(EventConflictDecision.CONFLICT);
    });

    test('detects a different source device', () => {
        const incoming = createEvent();

        incoming.sourceId = 'field-device-02';

        const decision = policy.evaluate({
            incomingEvent: incoming,
            existingEvent: createEvent()
        });

        expect(decision).toBe(EventConflictDecision.CONFLICT);
    });

    test('detects a changed event type', () => {
        const incoming = createEvent();

        incoming.eventType = 'LotCancelled';

        const decision = policy.evaluate({
            incomingEvent: incoming,
            existingEvent: createEvent()
        });

        expect(decision).toBe(EventConflictDecision.CONFLICT);
    });

    test('detects a changed event occurrence time', () => {
        const incoming = createEvent();

        incoming.occurredAt = '2026-10-08T13:00:00Z';

        const decision = policy.evaluate({
            incomingEvent: incoming,
            existingEvent: createEvent()
        });

        expect(decision).toBe(EventConflictDecision.CONFLICT);
    });

    test('does not deduplicate events by weight or origin', () => {
        const incoming = createEvent();

        incoming.clientEventId =
            '55555555-5555-4555-8555-555555555555';

        // The repository finds no event with this new identity.
        const decision = policy.evaluate({
            incomingEvent: incoming,
            existingEvent: null
        });

        expect(decision).toBe(EventConflictDecision.NEW);
    });

    test('refuses to compare different event identifiers', () => {
        const existing = createEvent();

        existing.clientEventId =
            '55555555-5555-4555-8555-555555555555';

        expect(() => policy.evaluate({
            incomingEvent: createEvent(),
            existingEvent: existing
        })).toThrow(InvalidEventComparisonError);
    });

    test('refuses to compare different tenants', () => {
        const existing = createEvent();

        existing.tenantId =
            '66666666-6666-4666-8666-666666666666';

        expect(() => policy.evaluate({
            incomingEvent: createEvent(),
            existingEvent: existing
        })).toThrow(InvalidEventComparisonError);
    });

    test('rejects non-JSON values in payload', () => {
        const incoming = createEvent();

        incoming.payload.weight = undefined;

        expect(() => policy.evaluate({
            incomingEvent: incoming
        })).toThrow(InvalidEventComparisonError);
    });

    test('rejects repeated dependencies', () => {
        const incoming = createEvent();

        incoming.dependencies = [
            DEPENDENCY_A,
            DEPENDENCY_A
        ];

        expect(() => policy.evaluate({
            incomingEvent: incoming
        })).toThrow(InvalidEventComparisonError);
    });

    test('rejects circular payload references', () => {
        const incoming = createEvent();

        incoming.payload.circular = incoming.payload;

        expect(() => policy.evaluate({
            incomingEvent: incoming
        })).toThrow(InvalidEventComparisonError);
    });
});