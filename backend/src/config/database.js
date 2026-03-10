const { Pool } = require('pg');
const logger   = require('../utils/logger');

let pool;

const connectDB = async () => {
  pool = new Pool({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'safeg_ai',
    user:     process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max:      20,        // max pool connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => logger.error('PG pool error:', err));

  // Test connection
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  return pool;
};

const getDB  = () => {
  if (!pool) throw new Error('Database not initialised — call connectDB() first');
  return pool;
};

// Transaction helper
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { connectDB, getDB, withTransaction };
