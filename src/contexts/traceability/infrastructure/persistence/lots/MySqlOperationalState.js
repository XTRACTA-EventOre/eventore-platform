import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { MySqlUnitOfWork } from './MySqlLotStore.js';
import { OperationError } from '../../../../../shared/application/OperationError.js';
import { compareCheckpoint } from '../../../../../shared/domain/decimalMass.js';
import { uuid, text } from '../../../../../shared/infrastructure/http/operationHttp.js';

export class MySqlOperationalState {
  constructor(pool) { this.pool = pool; this.unitOfWork = new MySqlUnitOfWork(pool); }
  async snapshot(tenantId, lotId, db = this.pool) {
    const [[lot]] = await db.execute(`SELECT l.id AS lotId,l.tenant_id AS tenantId,l.status,l.version,l.mineral_type AS mineralType,
      l.weight,l.weight_unit AS weightUnit,e.review_status AS originEvidenceStatus,e.reference AS evidenceReference
      FROM mineral_lots l JOIN origin_evidence e ON e.tenant_id=l.tenant_id AND e.lot_id=l.id
      WHERE l.tenant_id=? AND l.id=?`, [tenantId, lotId]);
    if (!lot) throw new OperationError(404, 'LOT_NOT_FOUND', 'Lote no encontrado');
    const [rows] = await db.execute('SELECT result FROM lot_lifecycle_events WHERE tenant_id=? AND lot_id=?', [tenantId, lotId]);
    const history = rows.map(row => row.result).sort((a,b) => a.version - b.version);
    const custody = [...history].reverse().find(event => ['CustodyAccepted','DelegationAccepted','PlantReceived'].includes(event.action));
    const checkpoint = [...history].reverse().find(event => event.action === 'CheckpointRecorded');
    const [restrictions] = await db.execute('SELECT id,reason FROM lot_restrictions WHERE tenant_id=? AND lot_id=? AND active=true', [tenantId, lotId]);
    const [delegations] = await db.execute("SELECT id,sender_id AS senderId,recipient_id AS recipientId,expires_at AS expiresAt FROM lot_delegations WHERE tenant_id=? AND lot_id=? AND state='Proposed' AND expires_at>UTC_TIMESTAMP(3)", [tenantId, lotId]);
    return { ...lot, history, restrictions, delegations, custodianUserId: custody?.custodianUserId ?? null,
      checkpointReference: checkpoint ? { weight: checkpoint.comparison.measuredWeight, weightUnit: checkpoint.comparison.measuredUnit } : { weight: lot.weight, weightUnit: lot.weightUnit } };
  }
  async execute(command, permissions) {
    return this.unitOfWork.run(async tx => {
      const { tenantId, lotId, operationId, actorId, action, expectedVersion } = command;
      const [locked] = await tx.execute('SELECT id FROM mineral_lots WHERE tenant_id=? AND id=? FOR UPDATE', [tenantId, lotId]);
      if (!locked.length) throw new OperationError(404, 'LOT_NOT_FOUND', 'Lote no encontrado');
      const [old] = await tx.execute('SELECT command,result FROM lot_lifecycle_events WHERE tenant_id=? AND operation_id=?', [tenantId, operationId]);
      if (old.length) {
        if (!isDeepStrictEqual(old[0].command, command)) throw new OperationError(409, 'OPERATION_ID_REUSED', 'El identificador corresponde a otra operación');
        return old[0].result;
      }
      const state = await this.snapshot(tenantId, lotId, tx);
      if (state.version !== expectedVersion) throw new OperationError(409, 'VERSION_CONFLICT', 'El lote cambió; vuelve a consultarlo');
      const result = { operationId, lotId, action, actorId, occurredAt: new Date().toISOString(), version: state.version + 1, status: state.status };
      const inTransit = () => { if (state.status !== 'InTransit') throw new OperationError(409, 'INVALID_LOT_STATE', 'El lote debe estar en transporte'); };
      const currentCustodian = () => { if (state.custodianUserId !== actorId && !permissions.includes('shipments.supervise')) throw new OperationError(403, 'NOT_CUSTODIAN', 'La operación corresponde al custodio actual'); };
      const transferable = () => { if (state.restrictions.length) throw new OperationError(409, 'TRANSFER_RESTRICTED', 'Existe una restricción operativa pendiente de revisión'); };
      if (action === 'CheckpointRecorded') {
        inTransit(); if (!permissions.includes('shipments.weigh')) currentCustodian();
        result.comparison = compareCheckpoint(state.checkpointReference, command.measurement);
        result.location = text(command.location, 'Checkpoint', 200);
        if (result.comparison.critical) {
          result.restrictionId = operationId;
          await tx.execute('INSERT INTO lot_restrictions(id,tenant_id,lot_id,reason) VALUES(?,?,?,?)', [operationId, tenantId, lotId, 'Diferencia de peso de al menos 10% pendiente de revisión']);
        }
      } else if (action === 'IncidentReported') {
        inTransit(); currentCustodian(); result.description = text(command.description, 'Descripción');
        if (!['Information','Blocking'].includes(command.severity) || !Array.isArray(command.photos) || command.photos.length < 1 || command.photos.length > 4) throw new OperationError(400, 'INVALID_INCIDENT', 'Indica severidad y entre una y cuatro fotografías');
        result.photos = command.photos; result.severity = command.severity;
        if (command.severity === 'Blocking') {
          result.restrictionId = operationId;
          await tx.execute('INSERT INTO lot_restrictions(id,tenant_id,lot_id,reason) VALUES(?,?,?,?)', [operationId, tenantId, lotId, result.description]);
        }
      } else if (action === 'DelegationProposed') {
        inTransit(); transferable();
        if (state.custodianUserId !== actorId) throw new OperationError(403, 'NOT_CUSTODIAN', 'Solo el custodio actual puede proponer el relevo');
        const recipient = uuid(command.recipientUserId, 'Destinatario');
        if (recipient === actorId) throw new OperationError(400, 'INVALID_RECIPIENT', 'Selecciona otro transportista');
        await tx.execute("UPDATE lot_delegations SET state='Revoked' WHERE tenant_id=? AND lot_id=? AND state='Proposed'", [tenantId, lotId]);
        result.delegationId = operationId; result.recipientUserId = recipient;
        await tx.execute("INSERT INTO lot_delegations(id,tenant_id,lot_id,sender_id,recipient_id,state,expires_at) VALUES(?,?,?,?,?,'Proposed',?)", [operationId, tenantId, lotId, actorId, recipient, new Date(Date.now()+86400000)]);
      } else if (action === 'DelegationAccepted') {
        inTransit(); transferable();
        const [[proposal]] = await tx.execute('SELECT * FROM lot_delegations WHERE tenant_id=? AND lot_id=? AND id=? FOR UPDATE', [tenantId, lotId, uuid(command.delegationId)]);
        if (!proposal || proposal.state !== 'Proposed' || new Date(proposal.expires_at) <= new Date()) throw new OperationError(409, 'INVALID_DELEGATION', 'El relevo no está disponible o venció');
        if (proposal.recipient_id !== actorId || proposal.sender_id !== state.custodianUserId) throw new OperationError(403, 'INVALID_RECIPIENT', 'El relevo corresponde a otro transportista o custodio');
        result.custodianUserId = actorId; result.previousCustodianUserId = proposal.sender_id;
        result.delegationId = proposal.id;
        await tx.execute("UPDATE lot_delegations SET state='Accepted' WHERE id=?", [proposal.id]);
      } else if (action === 'PlantReceived') {
        inTransit();
        if (state.restrictions.length && (command.quarantineDecision !== 'ReceiveUnderQuarantine' || !command.reviewReason?.trim())) {
          throw new OperationError(409, 'QUARANTINE_REVIEW_REQUIRED', 'Indica la recepción bajo cuarentena y el motivo de la decisión autorizada');
        }
        result.status = 'Received'; result.custodianUserId = actorId; result.previousCustodianUserId = state.custodianUserId;
        result.quarantineRetained = state.restrictions.length > 0;
        result.reviewReason = command.reviewReason ? text(command.reviewReason, 'Motivo') : null;
        await tx.execute("UPDATE lot_delegations SET state='Revoked' WHERE tenant_id=? AND lot_id=? AND state='Proposed'", [tenantId, lotId]);
      } else if (action === 'RestrictionReviewed') {
        const restrictionId = uuid(command.restrictionId);
        const [[restriction]] = await tx.execute('SELECT id FROM lot_restrictions WHERE tenant_id=? AND lot_id=? AND id=? AND active=true', [tenantId, lotId, restrictionId]);
        if (!restriction) throw new OperationError(404, 'RESTRICTION_NOT_FOUND', 'Restricción activa no encontrada');
        if (!['Release','Maintain'].includes(command.decision)) throw new OperationError(400, 'INVALID_DECISION', 'Selecciona liberar o mantener la restricción');
        result.reason = text(command.reason, 'Motivo de revisión'); result.restrictionId = restrictionId; result.decision = command.decision;
        if (command.decision === 'Release') await tx.execute('UPDATE lot_restrictions SET active=false WHERE id=?', [restrictionId]);
      } else if (action === 'EvidenceReviewed') {
        if (!['Verified','Rejected'].includes(command.reviewStatus)) throw new OperationError(400, 'INVALID_DECISION', 'Selecciona el resultado de revisión');
        result.reason = text(command.reason, 'Motivo de revisión'); result.reviewStatus = command.reviewStatus;
        await tx.execute('UPDATE origin_evidence SET review_status=? WHERE tenant_id=? AND lot_id=?', [command.reviewStatus, tenantId, lotId]);
      } else throw new OperationError(400, 'INVALID_ACTION', 'Operación no reconocida');
      await tx.execute('UPDATE mineral_lots SET status=?,version=? WHERE tenant_id=? AND id=?', [result.status, result.version, tenantId, lotId]);
      await tx.execute('INSERT INTO lot_lifecycle_events(operation_id,tenant_id,lot_id,actor_id,action,command,result) VALUES(?,?,?,?,?,?,?)', [operationId, tenantId, lotId, actorId, action, JSON.stringify(command), JSON.stringify(result)]);
      return result;
    });
  }
  async find(tenantId, operationId) {
    const [[row]] = await this.pool.execute('SELECT result FROM lot_lifecycle_events WHERE tenant_id=? AND operation_id=?', [tenantId, operationId]);
    if (!row) throw new OperationError(404, 'OPERATION_NOT_FOUND', 'Operación no encontrada');
    return row.result;
  }
}
