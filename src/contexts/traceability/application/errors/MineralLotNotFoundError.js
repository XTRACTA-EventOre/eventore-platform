export class MineralLotNotFoundError extends Error {
    constructor() {
        super('Mineral lot not found');

        this.name = 'MineralLotNotFoundError';
        this.code = 'MINERAL_LOT_NOT_FOUND';
    }
}