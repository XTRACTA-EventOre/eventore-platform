import {
    EvidenceReviewStatus
} from '../constants/TraceabilityConstants.js';

import {
    assertUuid,
    assertRequiredText
} from '../validation/domainAssertions.js';

export class OriginEvidence {
    #id;
    #lotId;
    #reference;
    #source;
    #reviewStatus;

    constructor({ id, lotId, reference, source }) {
        this.#id = assertUuid(id, 'originEvidenceId');
        this.#lotId = assertUuid(lotId, 'lotId');

        this.#reference = assertRequiredText(
            reference,
            'originEvidence.reference'
        );

        this.#source = assertRequiredText(
            source,
            'originEvidence.source'
        );

        this.#reviewStatus =
            EvidenceReviewStatus.PENDING_REVIEW;

        Object.freeze(this);
    }

    get id() {
        return this.#id;
    }

    get lotId() {
        return this.#lotId;
    }

    get reference() {
        return this.#reference;
    }

    get source() {
        return this.#source;
    }

    get reviewStatus() {
        return this.#reviewStatus;
    }

    toPrimitives() {
        return {
            id: this.#id,
            lotId: this.#lotId,
            reference: this.#reference,
            source: this.#source,
            reviewStatus: this.#reviewStatus
        };
    }
}