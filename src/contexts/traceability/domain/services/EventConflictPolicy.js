import {
    EventConflictDecision
} from '../constants/EventConflictDecision.js';

import {
    InvalidEventComparisonError
} from '../errors/InvalidEventComparisonError.js';

import {
    EventFingerprint
} from '../value-objects/EventFingerprint.js';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getEventIdentity(event) {
    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {
        throw new InvalidEventComparisonError(
            'Event must be an object'
        );
    }

    if (
        typeof event.tenantId !== 'string' ||
        !UUID_PATTERN.test(event.tenantId)
    ) {
        throw new InvalidEventComparisonError(
            'tenantId must be a valid UUID'
        );
    }

    if (
        typeof event.clientEventId !== 'string' ||
        !UUID_PATTERN.test(event.clientEventId)
    ) {
        throw new InvalidEventComparisonError(
            'clientEventId must be a valid UUID'
        );
    }

    return {
        tenantId: event.tenantId.toLowerCase(),
        clientEventId: event.clientEventId.toLowerCase()
    };
}

export class EventConflictPolicy {
    evaluate({
                 incomingEvent,
                 existingEvent = null
             }) {
        const incomingIdentity = getEventIdentity(incomingEvent);

        const incomingFingerprint = new EventFingerprint(
            incomingEvent
        );

        if (existingEvent === null) {
            return EventConflictDecision.NEW;
        }

        const existingIdentity = getEventIdentity(existingEvent);

        if (
            incomingIdentity.tenantId !== existingIdentity.tenantId ||
            incomingIdentity.clientEventId !==
            existingIdentity.clientEventId
        ) {
            throw new InvalidEventComparisonError(
                'Events must share tenantId and clientEventId'
            );
        }

        const existingFingerprint = new EventFingerprint(
            existingEvent
        );

        if (incomingFingerprint.equals(existingFingerprint)) {
            return EventConflictDecision.REPLAY;
        }

        return EventConflictDecision.CONFLICT;
    }
}