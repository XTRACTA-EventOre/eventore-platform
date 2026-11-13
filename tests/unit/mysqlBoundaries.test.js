import { describe, test, expect } from '@jest/globals';
import { MineralWeight } from '../../src/contexts/traceability/domain/value-objects/MineralWeight.js';
import { assertIsoTimestamp } from '../../src/contexts/traceability/domain/validation/domainAssertions.js';
import { createMySqlPool, toSqlTimestamp } from '../../src/shared/infrastructure/persistence/mysql.js';

describe('MySQL input boundaries', () => {
  test('preserves the full supported decimal without floating-point conversion', () => {
    const value = '9'.repeat(35) + '.' + '1'.repeat(30);
    expect(new MineralWeight(value, 'kg').amount).toBe(value);
  });
  test.each(['9'.repeat(36), '0.' + '1'.repeat(31)])('rejects values that MySQL would overflow or round', value => {
    expect(() => new MineralWeight(value, 'kg')).toThrow('35 integer and 30 fractional digits');
  });
  test('rejects UTC dates outside the storage range', () => {
    expect(() => assertIsoTimestamp('0999-12-31T23:59:59Z', 'occurredAt')).toThrow();
    expect(() => assertIsoTimestamp('9999-12-31T23:59:59-01:00', 'occurredAt')).toThrow();
  });
  test('normalizes offsets to UTC while preserving six fractional digits', () => {
    expect(toSqlTimestamp('2026-11-13T12:00:00.123456-05:00')).toBe('2026-11-13 17:00:00.123456');
    expect(() => assertIsoTimestamp('2026-11-13T12:00:00.1234567Z', 'occurredAt')).toThrow();
  });
  test('rejects a PostgreSQL connection URL instead of silently using it', () => {
    expect(() => createMySqlPool('postgres://user:example@localhost/db')).toThrow('mysql://');
  });
});
