import { EventConflictPolicy } from '../../../domain/services/EventConflictPolicy.js';

export class EventReplayGuard {
  constructor(policy = new EventConflictPolicy()) { this.policy = policy; }
  resolve(incoming, record) {
    const decision = this.policy.evaluate({
      incomingEvent: incoming,existingEvent: record.envelope });
    if (decision === 'Conflict') {
      return { status: 'Conflict',reason: 'EVENT_ID_REUSED' };
    }
    if (decision !== 'Replay' || !record.outcome) {
      throw new Error('El evento no tiene resultado confirmado');
    }
    if (record.outcome.status === 'Accepted') {
      return { ...record.outcome,status: 'AlreadyProcessed' };
    }
    return { ...record.outcome };
  }
}
