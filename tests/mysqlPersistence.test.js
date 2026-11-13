import { describe, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { makeMySqlRuntime } from './sprint1/breithner/mysqlFixture.js';
import { event, tenantId } from './sprint1/breithner/fixtures.js';
import { migrationSets, runMigrations } from '../src/shared/infrastructure/persistence/runMigrations.js';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('MySQL storage guarantees', () => {
  test('round-trips exact decimals, UTF-8 JSON and UTC timestamps', async () => {
    const r = await makeMySqlRuntime();
    try {
      const weight = '12345678901234567890123456789012345.123456789012345678901234567891';
      const input = { ...event, clientEventId: randomUUID(), occurredAt: '2026-11-13T12:00:00.123456-05:00',
        payload: { ...event.payload, weight, mineralType: 'Mineral declarado con una descripción de más de treinta y dos caracteres',
          originEvidence: { reference: 'REF-Ñ', source: 'Mina Áncash ⛏️' } } };
      const outcome = await r.processor.process({ tenantId, actorId: 'test-user', sourceId: 'device-01', event: input });
      expect(outcome.status).toBe('Accepted');
      expect((await r.lotStore.findById({ tenantId, lotId: outcome.lotId })).weight).toBe(weight);
      expect((await r.lotStore.findById({ tenantId, lotId: outcome.lotId })).mineralType).toBe(input.payload.mineralType);
      const [[stored]] = await r.pool.query("SELECT occurred_at,payload,DATE_FORMAT(occurred_at,'%f') AS micros FROM trace_events");
      expect(stored.occurred_at.toISOString()).toBe('2026-11-13T17:00:00.123Z');
      expect(stored.micros).toBe('123456');
      expect(stored.payload.weight).toBe(weight);
      const [[evidence]] = await r.pool.query('SELECT source FROM origin_evidence');
      expect(evidence.source).toBe('Mina Áncash ⛏️');
    } finally { await r.close(); }
  });

  test('four simultaneous retries create one atomic effect', async () => {
    const r = await makeMySqlRuntime();
    try {
      const input = { tenantId, actorId: 'test-user', sourceId: 'device-01',
        event: { ...event, clientEventId: randomUUID() } };
      const outcomes = await Promise.all(Array.from({ length: 4 }, () => r.processor.process(input)));
      expect(outcomes.filter(o => o.status === 'Accepted')).toHaveLength(1);
      expect(outcomes.filter(o => o.status === 'AlreadyProcessed')).toHaveLength(3);
      expect(new Set(outcomes.map(o => o.lotId)).size).toBe(1);
      for (const table of ['mineral_lots', 'event_inbox', 'event_outbox']) {
        const [[{ n }]] = await r.pool.query(`SELECT COUNT(*) AS n FROM ${table}`);
        expect(Number(n)).toBe(1);
      }
    } finally { await r.close(); }
  });

  test('migrations serialize, resume missing records and reject changed checksums', async () => {
    const r = await makeMySqlRuntime();
    try {
      const names = [...migrationSets.traceability, ...migrationSets.identity];
      await Promise.all([runMigrations(r.pool, names), runMigrations(r.pool, names)]);
      await r.pool.execute('DELETE FROM schema_migrations WHERE name=?', [names[0]]);
      await runMigrations(r.pool, names);
      const [[{ n }]] = await r.pool.query('SELECT COUNT(*) AS n FROM schema_migrations');
      expect(Number(n)).toBe(names.length);
      await r.pool.execute('UPDATE schema_migrations SET checksum=? WHERE name=?', ['0'.repeat(64), names[0]]);
      await expect(runMigrations(r.pool, names)).rejects.toThrow('La migración aplicada cambió');
    } finally { await r.close(); }
  });
});
