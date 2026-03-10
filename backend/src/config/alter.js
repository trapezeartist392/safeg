/**
 * SafeG AI — Alter: add missing columns to users table
 * Run ONCE: node src/config/alter.js
 */
require('dotenv').config();
const { connectDB, getDB } = require('./database');
const logger = require('../utils/logger');

async function alter() {
  await connectDB();
  const db = getDB();
  logger.info('Running alter migrations...');
  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plant_ids UUID[]`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name VARCHAR(200)`,
  ];
  for (const sql of statements) {
    try {
      await db.query(sql);
      logger.info('OK: ' + sql.substring(0, 60));
    } catch (err) {
      logger.error('SKIP: ' + err.message);
    }
  }
  logger.info('✅ Alter complete');
  process.exit(0);
}
alter().catch(err => { logger.error(err.message); process.exit(1); });
