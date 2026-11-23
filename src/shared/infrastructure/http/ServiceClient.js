import { OperationError } from '../../application/OperationError.js';
export class ServiceClient {
  constructor({ url, secret, fetchImpl = fetch }) { Object.assign(this, { url, secret, fetchImpl }); }
  async request(path, { req, tenantId, body, method = body ? 'POST' : 'GET' } = {}) {
    try {
      const response = await this.fetchImpl(new URL(path, this.url), { method,
        headers: { 'x-internal-secret': this.secret, ...(req?.headers.cookie ? { cookie: req.headers.cookie } : {}),
          ...(tenantId ? { 'x-service-tenant': tenantId } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(6000) });
      const result = await response.json();
      if (!response.ok) {
        if ([400,401,403,404,409,422].includes(response.status)) throw new OperationError(response.status, result.error?.code ?? 'REMOTE_REJECTED', result.error?.message ?? 'Operación rechazada');
        throw new Error('Servicio no disponible');
      }
      return result;
    } catch (error) {
      if (error instanceof OperationError) throw error;
      throw new OperationError(503, 'SERVICE_UNAVAILABLE', 'No se pudo confirmar la operación con el servicio responsable');
    }
  }
}
