import { DomainError } from '../errors/DomainError.js';
import { WeightUnit } from '../constants/TraceabilityConstants.js';

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const SUPPORTED_UNITS = Object.freeze(
    Object.values(WeightUnit)
);

export class MineralWeight {
    #amount;
    #unit;

    constructor(amount, unit) {
        if (
            typeof amount !== 'string' ||
            !DECIMAL_PATTERN.test(amount) ||
            !/[1-9]/.test(amount)
        ) {
            throw new DomainError(
                'INVALID_WEIGHT',
                'Mineral weight must be a positive decimal string'
            );
        }

        if (!SUPPORTED_UNITS.includes(unit)) {
            throw new DomainError(
                'UNSUPPORTED_WEIGHT_UNIT',
                'Mineral weight unit is not supported'
            );
        }

        this.#amount = amount;
        this.#unit = unit;

        Object.freeze(this);
    }

    get amount() {
        return this.#amount;
    }

    get unit() {
        return this.#unit;
    }

    equals(other) {
        return other instanceof MineralWeight &&
            this.#amount === other.amount &&
            this.#unit === other.unit;
    }

    toPrimitives() {
        return {
            amount: this.#amount,
            unit: this.#unit
        };
    }
}