import express from 'express';
import { healthRouter } from '../../../../shared/infrastructure/http/health.routes.js';
import { PgUnitOfWork,PgLotStore } from '../persistence/lots/PgLotStore.js';
import { PgEventJournal } from '../persistence/messaging/PgEventJournal.js';
import { TraceabilityEventProcessor } from '../../application/services/processing/TraceabilityEventProcessor.js';
import { EventReplayGuard } from '../../application/services/processing/EventReplayGuard.js';
import { SynchronizeEvents } from '../../application/use-cases/SynchronizeEvents.js';
import { GetMineralLotDetails } from '../../application/use-cases/GetMineralLotDetails.js';
import { createRegistrationRouter } from '../http/registration/registration.routes.js';
import { createQrRouter } from '../http/qr/qr.routes.js';
import { createSynchronizationRouter } from '../http/synchronization.routes.js';
import { createLotLookupRouter } from '../http/lotLookup.routes.js';

const requireSession = (req,res) => res.status(401).json({ error: {
        code: 'UNAUTHORIZED',message: 'Se requiere una sesión' } });

export function createSprint1App({ pool,runtime,authenticate = requireSession,
                                     appBaseUrl = 'http://localhost:5173' } = {}) {
    const app = express(); app.disable('x-powered-by'); app.use(express.json());
    app.use('/api/v1/health',healthRouter);
    if (!runtime && pool) {
        const unitOfWork = new PgUnitOfWork(pool); const lotStore = new PgLotStore(pool);
        const journal = new PgEventJournal();
        const processor = new TraceabilityEventProcessor({ unitOfWork,lotStore,journal,
            replayGuard: new EventReplayGuard() });
        runtime = { processor,lotStore };
    }
    if (!runtime) {
        app.use(['/api/v1/lots','/api/v1/events'],authenticate,(req,res) =>
            res.status(503).json({ error: { code: 'STORAGE_UNAVAILABLE',
                    message: 'Falta configurar PostgreSQL' } }));
        return app;
    }
    const getMineralLotDetails = new GetMineralLotDetails({ mineralLotReader: runtime.lotStore });
    app.use('/api/v1/lots',createRegistrationRouter({
        processor: runtime.processor,getMineralLotDetails,authenticate }));
    app.use('/api/v1/lots',createLotLookupRouter({ getMineralLotDetails,authenticate }));
    app.use('/api/v1/lots',createQrRouter({ getMineralLotDetails,authenticate,appBaseUrl }));
    app.use('/api/v1/events',createSynchronizationRouter({ authenticate,
        synchronizeEvents: new SynchronizeEvents({ eventProcessor: runtime.processor }) }));
    return app;
}
