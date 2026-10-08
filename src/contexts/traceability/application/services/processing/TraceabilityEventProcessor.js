import { randomUUID } from 'node:crypto';
import { MineralLot } from '../../../domain/aggregates/MineralLot.js';
import { DomainError } from '../../../domain/errors/DomainError.js';

export class TraceabilityEventProcessor {
  constructor({ unitOfWork,lotStore,journal,replayGuard,
    uuid = randomUUID,clock = () => new Date().toISOString() }) {
    Object.assign(this,{ unitOfWork,lotStore,journal,replayGuard,uuid,clock });
  }
  register({ tenantId,actorId,clientEventId,payload }) {
    return this.process({ tenantId,actorId,sourceId: 'web-online',
      serverTimestamp: true,event: { clientEventId,eventType: 'LotRegistered',
        occurredAt: this.clock(),dependencies: [],payload } });
  }
  process({ tenantId,actorId,sourceId,event,serverTimestamp = false }) {
    return this.unitOfWork.run(async tx => {
      let incoming = { ...event,clientEventId: event.clientEventId.toLowerCase(),
        tenantId: tenantId.toLowerCase(),sourceId };
      const record = await this.journal.reserve({ tx,envelope: incoming });
      if (!record.fresh) {
        if (serverTimestamp && record.envelope.sourceId === 'web-online') {
          incoming = { ...incoming,occurredAt: record.envelope.occurredAt };
        }
        return this.replayGuard.resolve(incoming,record);
      }
      let lot;
      let outcome;
      try {
        if (incoming.eventType !== 'LotRegistered') {
          throw new DomainError('UNSUPPORTED_EVENT','Evento no soportado');
        }
        if (incoming.dependencies.length) {
          throw new DomainError('UNSUPPORTED_DEPENDENCIES','Dependencias aún no soportadas');
        }
        lot = MineralLot.register({ ...incoming.payload,
          id: this.uuid(),tenantId: incoming.tenantId,
          originEvidence: { ...incoming.payload.originEvidence,id: this.uuid() },
          traceEventId: this.uuid(),clientEventId: incoming.clientEventId,
          sourceId,occurredAt: incoming.occurredAt });
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        outcome = { status: 'Rejected',reason: error.code };
      }
      if (lot) {
        await this.lotStore.save({ tx,lot });
        outcome = { status: 'Accepted',lotId: lot.id,reason: null };
        await this.journal.appendOutbox({ tx,envelope: incoming,
          lotId: lot.id,messageId: this.uuid() });
      }
      await this.journal.complete({ tx,envelope: incoming,outcome });
      return outcome;
    });
  }
}
