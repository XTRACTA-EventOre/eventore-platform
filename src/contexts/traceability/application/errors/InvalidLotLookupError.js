export class InvalidLotLookupError extends Error {
    constructor(message = 'Invalid mineral lot identifier') {
        super(message);

        this.name = 'InvalidLotLookupError';
        this.code = 'INVALID_LOT_ID';
    }
}