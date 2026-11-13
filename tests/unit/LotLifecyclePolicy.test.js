import { describe, test, expect } from '@jest/globals';
import { requireRegisteredVersion, requireTransferAllowed, requireValidHandover } from '../../src/contexts/traceability/domain/services/LotLifecyclePolicy.js';
import { accessForRoles, requirePermission } from '../../src/shared/infrastructure/http/permissions.js';

describe('US18/US19 lifecycle rules', () => {
  test('only Registered at the consulted version can change', () => {
    expect(() => requireRegisteredVersion({ status: 'Registered', version: 1 }, 1)).not.toThrow();
    expect(() => requireRegisteredVersion(null, 1)).toThrow('Lote no encontrado');
    expect(() => requireRegisteredVersion({ status: 'Registered', version: 2 }, 1)).toThrow('El lote cambió');
    for (const status of ['Cancelled', 'InTransit']) expect(() => requireRegisteredVersion({ status, version: 1 }, 1)).toThrow('todavía no haya salido');
  });
  test('active restrictions prevent transfer', () => {
    expect(() => requireTransferAllowed([])).not.toThrow();
    expect(() => requireTransferAllowed([{ id: 'restriction' }])).toThrow('restricción operativa');
  });
  test('handover must be available, unexpired and addressed to the accepting user', () => {
    const handover = { state: 'Available', expires_at: '2027-01-01T00:00:00Z', recipient_user_id: 'carrier-a' };
    const now = new Date('2026-11-13T00:00:00Z');
    expect(() => requireValidHandover(handover, 'carrier-a', now)).not.toThrow();
    expect(() => requireValidHandover({ ...handover, recipient_user_id: null }, 'carrier-b', now)).not.toThrow();
    expect(() => requireValidHandover(handover, 'carrier-b', now)).toThrow('otro transportista');
    expect(() => requireValidHandover({ ...handover, state: 'Revoked' }, 'carrier-a', now)).toThrow('no está disponible');
    expect(() => requireValidHandover(handover, 'carrier-a', new Date('2028-01-01'))).toThrow('venció');
  });
});

describe('US05 least-privilege permission decisions', () => {
  test('operator cannot manage users, cancel or accept custody', () => {
    expect(accessForRoles(['Operator']).permissions).toEqual(['lots.read', 'lots.register']);
    expect(accessForRoles(['Transporter']).permissions).toEqual(['custody.accept', 'lots.read']);
    expect(accessForRoles(['Unknown']).permissions).toEqual([]);
  });
  test('absence of permission is forbidden even with a valid identity', () => {
    let status;
    const res = { status(value) { status = value; return this; }, json() {} };
    requirePermission('users.manage')({ identity: { tenantId: 'tenant', userId: 'user', permissions: ['lots.read'] } }, res, () => { throw new Error('must not continue'); });
    expect(status).toBe(403);
  });
});
