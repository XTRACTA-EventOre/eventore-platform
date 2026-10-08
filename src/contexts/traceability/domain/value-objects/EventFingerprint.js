import {
    InvalidEventComparisonError
} from '../errors/InvalidEventComparisonError.js';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function requireText(value, fieldName) {
    if (
        typeof value !== 'string' ||
        value.trim().length === 0
    ) {
        throw new InvalidEventComparisonError(
            `${fieldName} must not be empty`
        );
    }

    return value.trim();
}

function normalizeTimestamp(value) {
    if (
        typeof value !== 'string' ||
        !ISO_TIMESTAMP_PATTERN.test(value)
    ) {
        throw new InvalidEventComparisonError(
            'occurredAt must be an ISO 8601 timestamp'
        );
    }

    const timestamp = new Date(value);

    if (Number.isNaN(timestamp.getTime())) {
        throw new InvalidEventComparisonError(
            'occurredAt is not a valid timestamp'
        );
    }

    return timestamp.toISOString();
}

function normalizeDependencies(dependencies) {
    if (!Array.isArray(dependencies)) {
        throw new InvalidEventComparisonError(
            'dependencies must be an array'
        );
    }

    const normalized = dependencies.map(dependency => {
        if (
            typeof dependency !== 'string' ||
            !UUID_PATTERN.test(dependency)
        ) {
            throw new InvalidEventComparisonError(
                'dependencies must contain valid UUIDs'
            );
        }

        return dependency.toLowerCase();
    });

    if (new Set(normalized).size !== normalized.length) {
        throw new InvalidEventComparisonError(
            'dependencies must not contain duplicates'
        );
    }

    return normalized.sort();
}

function canonicalizeJson(value, visiting = new WeakSet()) {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean'
    ) {
        return JSON.stringify(value);
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new InvalidEventComparisonError(
                'Event content contains a non-finite number'
            );
        }

        return JSON.stringify(value);
    }

    if (typeof value !== 'object') {
        throw new InvalidEventComparisonError(
            'Event content must contain only JSON values'
        );
    }

    if (visiting.has(value)) {
        throw new InvalidEventComparisonError(
            'Event content must not contain circular references'
        );
    }

    visiting.add(value);

    try {
        if (Array.isArray(value)) {
            const items = [];

            for (let index = 0; index < value.length; index++) {
                if (!Object.hasOwn(value, index)) {
                    throw new InvalidEventComparisonError(
                        'Event arrays must not contain empty positions'
                    );
                }

                items.push(canonicalizeJson(value[index], visiting));
            }

            return `[${items.join(',')}]`;
        }

        const prototype = Object.getPrototypeOf(value);

        if (
            prototype !== Object.prototype &&
            prototype !== null
        ) {
            throw new InvalidEventComparisonError(
                'Event content must contain plain JSON objects'
            );
        }

        const properties = Object.keys(value)
            .sort()
            .map(key => {
                const serializedValue = canonicalizeJson(
                    value[key],
                    visiting
                );

                return `${JSON.stringify(key)}:${serializedValue}`;
            });

        return `{${properties.join(',')}}`;
    } finally {
        visiting.delete(value);
    }
}

export class EventFingerprint {
    #value;

    constructor(event) {
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
            event.payload === null ||
            typeof event.payload !== 'object' ||
            Array.isArray(event.payload)
        ) {
            throw new InvalidEventComparisonError(
                'Event payload must be an object'
            );
        }

        const comparableContent = {
            sourceId: requireText(event.sourceId, 'sourceId'),
            eventType: requireText(event.eventType, 'eventType'),
            occurredAt: normalizeTimestamp(event.occurredAt),
            dependencies: normalizeDependencies(event.dependencies),
            payload: event.payload
        };

        this.#value = canonicalizeJson(comparableContent);

        Object.freeze(this);
    }

    equals(other) {
        return (
            other instanceof EventFingerprint &&
            this.#value === other.#value
        );
    }

    get value() {
        return this.#value;
    }
}