import express from 'express';
import { TraceabilityEventProcessor } from '../../../src/contexts/traceability/application/services/processing/TraceabilityEventProcessor.js';
import { EventReplayGuard } from '../../../src/contexts/traceability/application/services/processing/EventReplayGuard.js';
import { SynchronizeEvents } from '../../../src/contexts/traceability/application/use-cases/SynchronizeEvents.js';
import { GetMineralLotDetails } from '../../../src/contexts/traceability/application/use-cases/GetMineralLotDetails.js';
import { createSynchronizationRouter } from '../../../src/contexts/traceability/infrastructure/http/synchronization.routes.js';
import { createRegistrationRouter } from '../../../src/contexts/traceability/infrastructure/http/registration/registration.routes.js';
import { createLotLookupRouter } from '../../../src/contexts/traceability/infrastructure/http/lotLookup.routes.js';

export const tenantId = '11111111-1111-4111-8111-111111111111';
export const clientEventId = '22222222-2222-4222-8222-222222222222';
export const payload = { mineralType: 'Gold',weight: '125.50',weightUnit: 'kg',
    originEvidence: { reference: 'DOC-001',source: 'Operador' } };
export const event = { clientEventId,eventType: 'LotRegistered',
    occurredAt: '2026-10-08T12:00:00Z',dependencies: [],payload };
export const body = { sourceId: 'device-01',events: [event] };

export function makeMemoryRuntime() {
    const data = { inbox: new Map(),lots: new Map(),outbox: [] };
    const key = e => `${e.tenantId}:${e.clientEventId}`;
    const unitOfWork = { async run(work) {
            const before = structuredClone(data);
            try { return await work({}); }
            catch (error) { Object.assign(data,before); throw error; }
        } };
    const journal = {
        async reserve({ envelope }) {
            if (data.inbox.has(key(envelope))) {
                return { fresh: false,...data.inbox.get(key(envelope)) };
            }
            data.inbox.set(key(envelope),{ envelope: JSON.parse(JSON.stringify(envelope)),outcome: null });
            return { fresh: true };
        },
        async complete({ envelope,outcome }) {
            data.inbox.get(key(envelope)).outcome = JSON.parse(JSON.stringify(outcome));
        },
        async appendOutbox(message) { data.outbox.push(message); }
    };
    const lotStore = {
        async save({ lot }) { data.lots.set(lot.id,lot.toPrimitives()); },
        async findById({ lotId,tenantId: owner }) {
            const lot = data.lots.get(lotId);
            if (!lot || lot.tenantId !== owner) return null;
            return { ...lot,originEvidenceStatus: lot.originEvidence.reviewStatus };
        }
    };
    const processor = new TraceabilityEventProcessor({ unitOfWork,lotStore,journal,
        replayGuard: new EventReplayGuard() });
    return { data,processor,lotStore,unitOfWork,journal };
}

export function makeApp(runtime,{ authenticated = true,owner = tenantId } = {}) {
    const app = express(); app.use(express.json());
    const authenticate = (req,res,next) => {
        if (authenticated) req.identity = { tenantId: owner,userId: 'test-user' };
        next();
    };
    const getMineralLotDetails = new GetMineralLotDetails({ mineralLotReader: runtime.lotStore });
    app.use('/api/v1/lots',createRegistrationRouter({
        processor: runtime.processor,getMineralLotDetails,authenticate }));
    app.use('/api/v1/lots',createLotLookupRouter({ getMineralLotDetails,authenticate }));
    app.use('/api/v1/events',createSynchronizationRouter({ authenticate,
        synchronizeEvents: new SynchronizeEvents({ eventProcessor: runtime.processor }) }));
    return { app,authenticate,getMineralLotDetails };
}
