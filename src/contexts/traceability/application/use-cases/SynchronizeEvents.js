import {
    InvalidSynchronizationRequestError
} from '../errors/InvalidSynchronizationRequestError.js';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const PROCESSING_STATUSES = new Set([
    'Accepted',
    'AlreadyProcessed',
    'Conflict',
    'Rejected'
]);

function isRecord(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}

function requireText(value, fieldName) {
    if (
        typeof value !== 'string' ||
        value.trim().length === 0
    ) {
        throw new InvalidSynchronizationRequestError(
            `${fieldName} is required`
        );
    }

    return value.trim();
}

function requireUuid(value, fieldName) {
    if (
        typeof value !== 'string' ||
        !UUID_PATTERN.test(value)
    ) {
        throw new InvalidSynchronizationRequestError(
            `${fieldName} must be a valid UUID`
        );
    }

    return value;
}

function validateEvent(event, index) {
    if (!isRecord(event)) {
        throw new InvalidSynchronizationRequestError(
            `events[${index}] must be an object`
        );
    }

    requireUuid(
        event.clientEventId,
        `events[${index}].clientEventId`
    );

    requireText(
        event.eventType,
        `events[${index}].eventType`
    );

    if (
        typeof event.occurredAt !== 'string' ||
        !ISO_TIMESTAMP_PATTERN.test(event.occurredAt) ||
        Number.isNaN(Date.parse(event.occurredAt))
    ) {
        throw new InvalidSynchronizationRequestError(
            `events[${index}].occurredAt must be a valid timestamp`
        );
    }

    if (
        !Array.isArray(event.dependencies) ||
        !event.dependencies.every(
            dependency => UUID_PATTERN.test(dependency)
        )
    ) {
        throw new InvalidSynchronizationRequestError(
            `events[${index}].dependencies must contain UUIDs`
        );
    }

    if (!isRecord(event.payload)) {
        throw new InvalidSynchronizationRequestError(
            `events[${index}].payload must be an object`
        );
    }

    return event;
}

export class SynchronizeEvents {
    #eventProcessor;

    constructor({ eventProcessor }) {
        if (typeof eventProcessor?.process !== 'function') {
            throw new TypeError(
                'An EventProcessor implementation is required'
            );
        }

        this.#eventProcessor = eventProcessor;
    }

    async execute({
                      tenantId,
                      actorId,
                      sourceId,
                      events
                  }) {
        requireUuid(tenantId, 'tenantId');
        requireText(actorId, 'actorId');
        requireText(sourceId, 'sourceId');

        if (!Array.isArray(events) || events.length === 0) {
            throw new InvalidSynchronizationRequestError(
                'At least one event is required'
            );
        }

        // Validate the whole request before processing anything.
        const validatedEvents = events.map(validateEvent);
        const results = [];

        for (const event of validatedEvents) {
            const outcome = await this.#eventProcessor.process({
                tenantId,
                actorId,
                sourceId,
                event
            });

            if (
                !isRecord(outcome) ||
                !PROCESSING_STATUSES.has(outcome.status)
            ) {
                throw new Error(
                    'EventProcessor returned an invalid result'
                );
            }

            const result = {
                clientEventId: event.clientEventId,
                status: outcome.status,
                reason: outcome.reason ?? null
            };

            if (outcome.lotId !== undefined) {
                result.lotId = outcome.lotId;
            }

            results.push(result);
        }

        return { results };
    }
}