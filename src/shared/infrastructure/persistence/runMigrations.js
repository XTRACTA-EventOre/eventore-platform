import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const migrationSets = {
  identity: ['identity/003_sessions.sql'],
  traceability: ['lots/001_register_lots.sql', 'messaging/002_inbox_outbox.sql']
};

export async function runMigrations(pool, names) {
  const tx = await pool.getConnection();
  let lockName, acquired = false;
  try {
    const [[{ name }]] = await tx.query('SELECT DATABASE() AS name');
    lockName = createHash('sha256').update(`eventore:migrations:${name}`).digest('hex');
    const [[{ locked }]] = await tx.execute('SELECT GET_LOCK(?,30) AS locked', [lockName]);
    if (Number(locked) !== 1) throw new Error('No se pudo bloquear el esquema para migraciones');
    acquired = true;
    await tx.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(191) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin`);
    for (const file of names) {
      const sql = await readFile(new URL(`../../../../database/migrations/${file}`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      const [rows] = await tx.execute('SELECT checksum FROM schema_migrations WHERE name=?', [file]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`La migración aplicada cambió: ${file}`);
        continue;
      }
      // MySQL commits DDL implicitly. Files contain only restartable CREATE TABLE statements.
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) {
        await tx.query(statement);
      }
      await tx.execute('INSERT INTO schema_migrations(name,checksum) VALUES(?,?)', [file, checksum]);
      console.log(`Migración MySQL aplicada: ${file}`);
    }
  } finally {
    if (acquired) await tx.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
    tx.release();
  }
}
