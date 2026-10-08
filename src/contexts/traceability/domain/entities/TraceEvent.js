import {
    TraceEventType
} from '../constants/TraceabilityConstants.js';

import {
    assertUuid,
    assertRequiredText,
    assertIsoTimestamp
} from '../validation/domainAssertions.js';

export class TraceEvent {
    #id;
    #clientEventId;
    #lotId;
    #tenantId;
    #sourceId;
    #eventType;
    #occurredAt;
    #payload;

    constructor({
                    id,
                    clientEventId,
                    lotId,
                    tenantId,
                    sourceId,
                    eventType,
                    occurredAt,
                    payload
                }) {
        this.#id = assertUuid(id, 'traceEventId');

        this.#clientEventId = assertUuid(
            clientEventId,
            'clientEventId'
        );

        this.#lotId = assertUuid(lotId, 'lotId');
        this.#tenantId = assertUuid(tenantId, 'tenantId');

        this.#sourceId = assertRequiredText(
            sourceId,
            'sourceId'
        );

        this.#eventType = assertRequiredText(
            eventType,
            'eventType'
        );

        this.#occurredAt = assertIsoTimestamp(
            occurredAt,
            'occurredAt'
        );

        this.#payload = Object.freeze({
            ...payload,
            originEvidence: Object.freeze({
                ...payload.originEvidence
            })
        });

        Object.freeze(this);
    }

    static lotRegistered({
                             id,
                             clientEventId,
                             lotId,
                             tenantId,
                             sourceId,
                             occurredAt,
                             mineralType,
                             mineralWeight,
                             originEvidence
                         }) {
        return new TraceEvent({
            id,
            clientEventId,
            lotId,
            tenantId,
            sourceId,
            eventType: TraceEventType.LOT_REGISTERED,
            occurredAt,
            payload: {
                mineralType: mineralType.value,
                weight: mineralWeight.amount,
                weightUnit: mineralWeight.unit,
                originEvidence: {
                    reference: originEvidence.reference,
                    source: originEvidence.source
                }
            }
        });
    }

    get id() {
        return this.#id;
    }

    get clientEventId() {
        return this.#clientEventId;
    }

    get eventType() {
        return this.#eventType;
    }

    toPrimitives() {
        return {
            id: this.#id,
            clientEventId: this.#clientEventId,
            lotId: this.#lotId,
            tenantId: this.#tenantId,
            sourceId: this.#sourceId,
            eventType: this.#eventType,
            occurredAt: this.#occurredAt,
            payload: {
                ...this.#payload,
                originEvidence: {
                    ...this.#payload.originEvidence
                }
            }
        };
    }
}