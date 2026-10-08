export class InvalidSynchronizationRequestError extends Error {
    constructor(message) {
        super(message);

        this.name = 'InvalidSynchronizationRequestError';
        this.code = 'INVALID_SYNC_REQUEST';
    }
}