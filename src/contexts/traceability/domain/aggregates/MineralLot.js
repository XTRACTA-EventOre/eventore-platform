import {
    LotStatus
} from '../constants/TraceabilityConstants.js';

import { DomainError } from '../errors/DomainError.js';

import {
    assertUuid,
    assertIsoTimestamp
} from '../validation/domainAssertions.js';

import { MineralType } from '../value-objects/MineralType.js';
import { MineralWeight } from '../value-objects/MineralWeight.js';

import { OriginEvidence } from '../entities/OriginEvidence.js';
import { TraceEvent } from '../entities/TraceEvent.js';

export class MineralLot {
    #id;
    #tenantId;
    #mineralType;
    #mineralWeight;
    #status;
    #version;
    #createdAt;
    #originEvidence;
    #traceEvents;

    constructor({
                    id,
                    tenantId,
                    mineralType,
                    mineralWeight,
                    status,
                    version,
                    createdAt,
                    originEvidence,
                    traceEvents
                }) {
        this.#id = id;
        this.#tenantId = tenantId;
        this.#mineralType = mineralType;
        this.#mineralWeight = mineralWeight;
        this.#status = status;
        this.#version = version;
        this.#createdAt = createdAt;
        this.#originEvidence = originEvidence;
        this.#traceEvents = Object.freeze([...traceEvents]);

        Object.freeze(this);
    }

    static register({
                        id,
                        tenantId,
                        mineralType,
                        weight,
                        weightUnit,
                        originEvidence,
                        traceEventId,
                        clientEventId,
                        sourceId,
                        occurredAt
                    }) {
        const validatedLotId = assertUuid(id, 'lotId');

        const validatedTenantId = assertUuid(
            tenantId,
            'tenantId'
        );

        const validatedTimestamp = assertIsoTimestamp(
            occurredAt,
            'occurredAt'
        );

        if (
            !originEvidence ||
            typeof originEvidence !== 'object' ||
            Array.isArray(originEvidence)
        ) {
            throw new DomainError(
                'ORIGIN_EVIDENCE_REQUIRED',
                'Origin evidence is required'
            );
        }

        const validatedMineralType = new MineralType(
            mineralType
        );

        const validatedMineralWeight = new MineralWeight(
            weight,
            weightUnit
        );

        const initialEvidence = new OriginEvidence({
            id: originEvidence.id,
            lotId: validatedLotId,
            reference: originEvidence.reference,
            source: originEvidence.source
        });

        const initialEvent = TraceEvent.lotRegistered({
            id: traceEventId,
            clientEventId,
            lotId: validatedLotId,
            tenantId: validatedTenantId,
            sourceId,
            occurredAt: validatedTimestamp,
            mineralType: validatedMineralType,
            mineralWeight: validatedMineralWeight,
            originEvidence: initialEvidence
        });

        return new MineralLot({
            id: validatedLotId,
            tenantId: validatedTenantId,
            mineralType: validatedMineralType,
            mineralWeight: validatedMineralWeight,
            status: LotStatus.REGISTERED,
            version: 1,
            createdAt: validatedTimestamp,
            originEvidence: initialEvidence,
            traceEvents: [initialEvent]
        });
    }

    get id() {
        return this.#id;
    }

    get tenantId() {
        return this.#tenantId;
    }

    get mineralType() {
        return this.#mineralType;
    }

    get mineralWeight() {
        return this.#mineralWeight;
    }

    get status() {
        return this.#status;
    }

    get version() {
        return this.#version;
    }

    get createdAt() {
        return this.#createdAt;
    }

    get originEvidence() {
        return this.#originEvidence;
    }

    get traceEvents() {
        return [...this.#traceEvents];
    }

    toPrimitives() {
        return {
            id: this.#id,
            tenantId: this.#tenantId,
            mineralType: this.#mineralType.value,
            weight: this.#mineralWeight.amount,
            weightUnit: this.#mineralWeight.unit,
            status: this.#status,
            version: this.#version,
            createdAt: this.#createdAt,
            originEvidence: this.#originEvidence.toPrimitives(),
            traceEvents: this.#traceEvents.map(
                event => event.toPrimitives()
            )
        };
    }
}