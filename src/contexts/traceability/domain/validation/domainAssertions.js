import { DomainError } from '../errors/DomainError.js';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function assertUuid(value, fieldName) {
    if (
        typeof value !== 'string' ||
        !UUID_PATTERN.test(value)
    ) {
        throw new DomainError(
            'INVALID_UUID',
            `${fieldName} must be a valid UUID`
        );
    }

    return value;
}

export function assertRequiredText(value, fieldName) {
    if (
        typeof value !== 'string' ||
        value.trim().length === 0
    ) {
        throw new DomainError(
            'INVALID_REQUIRED_TEXT',
            `${fieldName} must not be empty`
        );
    }

    return value.trim();
}

export function assertIsoTimestamp(value, fieldName) {
    if (
        typeof value !== 'string' ||
        !ISO_TIMESTAMP_PATTERN.test(value) ||
        Number.isNaN(Date.parse(value))
    ) {
        throw new DomainError(
            'INVALID_TIMESTAMP',
            `${fieldName} must be a valid ISO 8601 timestamp`
        );
    }

    return value;
}