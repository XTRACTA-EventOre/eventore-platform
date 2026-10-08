import {
    assertRequiredText
} from '../validation/domainAssertions.js';

export class MineralType {
    #value;

    constructor(value) {
        this.#value = assertRequiredText(
            value,
            'mineralType'
        );

        Object.freeze(this);
    }

    get value() {
        return this.#value;
    }

    equals(other) {
        return other instanceof MineralType &&
            this.#value === other.value;
    }

    toString() {
        return this.#value;
    }
}