import mysql from 'mysql2/promise';

export function toSqlTimestamp(value) {
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? '';
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ') + '.' + fraction.padEnd(6, '0');
}

export function createMySqlPool(connectionString) {
  if (!connectionString) throw new Error('Configura DATABASE_URL con una URL mysql://');
  const url = new URL(connectionString);
  if (url.protocol !== 'mysql:' || url.pathname.length < 2) {
    throw new Error('DATABASE_URL debe usar mysql:// y especificar una base de datos');
  }
  const pool = mysql.createPool({
    host: url.hostname, port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: 10, timezone: 'Z', charset: 'utf8mb4',
    decimalNumbers: false, supportBigNumbers: true, bigNumberStrings: true,
    multipleStatements: false
  });
  // Enqueued before application queries, on every new underlying connection.
  pool.on('connection', connection => { connection.query("SET time_zone = '+00:00'"); });
  return pool;
}
