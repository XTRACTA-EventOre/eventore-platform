import { randomUUID, createHash } from 'node:crypto';
import { DurableOperation } from '../../shared/infrastructure/persistence/DurableOperation.js';
import { ServiceClient } from '../../shared/infrastructure/http/ServiceClient.js';
import { OperationError } from '../../shared/application/OperationError.js';

export class ShipmentService {
  constructor({ pool, traceabilityUrl, identityUrl, internalSecret, fetchImpl = fetch }) {
    this.pool = pool; this.ledger = new DurableOperation(pool, 'logistics_operations');
    this.trace = new ServiceClient({ url: traceabilityUrl, secret: internalSecret, fetchImpl });
    this.identity = new ServiceClient({ url: identityUrl, secret: internalSecret, fetchImpl });
  }
  async reserveEvidence(command) {
    if (!Array.isArray(command.photoIds) || command.photoIds.length < 1 || command.photoIds.length > 4 || new Set(command.photoIds).size !== command.photoIds.length) throw new OperationError(400, 'INVALID_EVIDENCE', 'Adjunta entre una y cuatro fotografías diferentes');
    const tx = await this.pool.getConnection();
    try {
      await tx.beginTransaction();
      const [photos] = await tx.execute(`SELECT id,mime_type,byte_length,sha256,incident_operation_id FROM shipment_evidence
        WHERE tenant_id=? AND lot_id=? AND actor_id=? AND id IN (${command.photoIds.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,
        [command.tenantId, command.lotId, command.actorId, ...command.photoIds]);
      if (photos.length !== command.photoIds.length) throw new OperationError(400, 'INVALID_EVIDENCE', 'Fotografías no disponibles para este lote y usuario');
      if (photos.some(photo => photo.incident_operation_id && photo.incident_operation_id !== command.operationId)) throw new OperationError(409, 'EVIDENCE_ALREADY_USED', 'Una fotografía ya corresponde a otro incidente');
      for (const photo of photos) await tx.execute('UPDATE shipment_evidence SET incident_operation_id=? WHERE id=?', [command.operationId, photo.id]);
      await tx.commit();
      return photos.map(photo => ({ id: photo.id, mimeType: photo.mime_type, bytes: photo.byte_length, sha256: photo.sha256 }));
    } catch (error) { await tx.rollback().catch(() => {}); throw error; }
    finally { tx.release(); }
  }
  async confirm(command, result) {
    if (result.operationId !== command.operationId || result.lotId !== command.lotId || result.action !== command.action || result.actorId !== command.actorId || result.version !== command.expectedVersion + 1) throw new OperationError(503, 'INVALID_RESPONSE', 'Respuesta de trazabilidad sin confirmar');
    return this.ledger.confirm(command, result, async tx => {
      await tx.execute('INSERT INTO shipment_events(tenant_id,operation_id,lot_id,action,actor_id,result) VALUES(?,?,?,?,?,?)', [command.tenantId, command.operationId, command.lotId, command.action, command.actorId, JSON.stringify(result)]);
    });
  }
  async execute(command, req) {
    const record = await this.ledger.start(command);
    if (record.state === 'Accepted') return record.result;
    try {
      if (command.action === 'DelegationProposed') await this.identity.request(`/internal/transporters/${command.recipientUserId}`, { req });
      const photos = command.action === 'IncidentReported' ? await this.reserveEvidence(command) : undefined;
      const body = { ...command, ...(photos ? { photos } : {}) };
      const result = await this.trace.request(`/internal/lots/${command.lotId}/operations`, { req, body });
      return await this.confirm(command, result);
    } catch (error) {
      if (error instanceof OperationError && error.status < 500) {
        try {
          const found = await this.trace.request(`/internal/lot-operations/${command.operationId}`, { req });
          return await this.confirm(command, found);
        } catch (lookupError) {
          if (!(lookupError instanceof OperationError) || lookupError.status !== 404) throw lookupError;
        }
        await this.ledger.reject(command, error);
        if (command.action === 'IncidentReported') await this.pool.execute('UPDATE shipment_evidence SET incident_operation_id=NULL WHERE tenant_id=? AND incident_operation_id=?', [command.tenantId, command.operationId]);
      }
      throw error;
    }
  }
  async read(tenantId, lotId, req) {
    const snapshot = await this.trace.request(`/internal/lots/${lotId}/state`, { req });
    const [pending] = await this.pool.execute("SELECT command FROM logistics_operations WHERE tenant_id=? AND state='Pending' AND JSON_UNQUOTE(JSON_EXTRACT(command,'$.lotId'))=? LIMIT 100", [tenantId, lotId]);
    for (const row of pending) {
      try { await this.confirm(row.command, await this.trace.request(`/internal/lot-operations/${row.command.operationId}`, { req })); }
      catch (error) { if (!(error instanceof OperationError) || ![404,503].includes(error.status)) throw error; }
    }
    const [events] = await this.pool.execute('SELECT result FROM shipment_events WHERE tenant_id=? AND lot_id=?', [tenantId, lotId]);
    const [photos] = await this.pool.execute('SELECT id,mime_type AS mimeType,byte_length AS bytes,incident_operation_id AS incidentId FROM shipment_evidence WHERE tenant_id=? AND lot_id=? AND incident_operation_id IS NOT NULL', [tenantId, lotId]);
    return { snapshot, events: events.map(row => row.result).sort((a,b) => a.version-b.version), photos };
  }
  async upload(lotId, req) {
    const bytes = req.body, mime = req.get('content-type')?.split(';')[0];
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new OperationError(400, 'INVALID_EVIDENCE_SIZE', 'La fotografía debe tener como máximo 5 MB');
    const png = bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
    if (!(png && mime === 'image/png') && !(jpeg && mime === 'image/jpeg')) throw new OperationError(400, 'INVALID_EVIDENCE_FORMAT', 'Solo se aceptan fotografías JPG o PNG con contenido compatible');
    const snapshot = await this.trace.request(`/internal/lots/${lotId}/state`, { req });
    if (snapshot.status !== 'InTransit' || (snapshot.custodianUserId !== req.identity.userId && !req.identity.permissions.includes('shipments.supervise'))) throw new OperationError(403, 'NOT_CUSTODIAN', 'La evidencia corresponde al custodio del lote en transporte');
    const id = randomUUID(), digest = createHash('sha256').update(bytes).digest('hex');
    await this.pool.execute('INSERT INTO shipment_evidence(id,tenant_id,lot_id,actor_id,mime_type,byte_length,sha256,content) VALUES(?,?,?,?,?,?,?,?)', [id, req.identity.tenantId, lotId, req.identity.userId, mime, bytes.length, digest, bytes]);
    return { id, mimeType: mime, bytes: bytes.length, sha256: digest };
  }
}
