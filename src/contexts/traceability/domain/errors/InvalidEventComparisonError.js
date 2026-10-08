export class InvalidEventComparisonError extends Error {
    constructor(message) {
        super(message);

        this.name = 'InvalidEventComparisonError';
        this.code = 'INVALID_EVENT_COMPARISON';
    }
}