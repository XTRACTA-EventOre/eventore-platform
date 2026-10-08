import {
    LotStatus,
    EvidenceReviewStatus,
    WeightUnit
} from '../../domain/constants/TraceabilityConstants.js';

import {
    InvalidLotLookupError
} from '../errors/InvalidLotLookupError.js';

import {
    MineralLotNotFoundError
} from '../errors/MineralLotNotFoundError.js';

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LOT_STATUSES = Object.values(LotStatus);
const EVIDENCE_STATUSES = Object.values(EvidenceReviewStatus);
const WEIGHT_UNITS = Object.values(WeightUnit);

function isValidUuid(value) {
    return typeof value === 'string' &&
        UUID_PATTERN.test(value);
}

function isValidReadModel(lot) {
    return lot !== null &&
        typeof lot === 'object' &&
        typeof lot.mineralType === 'string' &&
        lot.mineralType.trim().length > 0 &&
        typeof lot.weight === 'string' &&
        /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(lot.weight) &&
        /[1-9]/.test(lot.weight) &&
        WEIGHT_UNITS.includes(lot.weightUnit) &&
        LOT_STATUSES.includes(lot.status) &&
        EVIDENCE_STATUSES.includes(lot.originEvidenceStatus) &&
        Number.isInteger(lot.version) &&
        lot.version > 0;
}

export class GetMineralLotDetails {
    #mineralLotReader;

    constructor({ mineralLotReader }) {
        if (typeof mineralLotReader?.findById !== 'function') {
            throw new TypeError(
                'A MineralLotReader implementation is required'
            );
        }

        this.#mineralLotReader = mineralLotReader;
    }

    async execute({ lotId, tenantId }) {
        if (!isValidUuid(lotId)) {
            throw new InvalidLotLookupError();
        }

        if (!isValidUuid(tenantId)) {
            throw new TypeError(
                'A valid authenticated tenant is required'
            );
        }

        const lot = await this.#mineralLotReader.findById({
            lotId,
            tenantId
        });

        if (lot === null) {
            throw new MineralLotNotFoundError();
        }

        // Defense in depth: never disclose another tenant's lot.
        if (
            lot.tenantId !== tenantId ||
            lot.id !== lotId
        ) {
            throw new MineralLotNotFoundError();
        }

        if (!isValidReadModel(lot)) {
            throw new Error('Invalid mineral lot read model');
        }

        return {
            lotId: lot.id,
            mineralType: lot.mineralType,
            weight: lot.weight,
            weightUnit: lot.weightUnit,
            status: lot.status,
            version: lot.version,
            originEvidenceStatus: lot.originEvidenceStatus,
            transportStatus:
                lot.status === LotStatus.CANCELLED
                    ? 'Blocked'
                    : 'RequiresValidation',
            qrProvesOrigin: false
        };
    }
}