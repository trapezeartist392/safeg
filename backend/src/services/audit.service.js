// ── audit.service.js
const { getDB } = require('../config/database');
const logger    = require('../utils/logger');

exports.auditLog = async ({ tenantId, userId, action, entityType, entityId, oldData, newData, req }) => {
  try {
    const db = getDB();
    await db.query(
      `INSERT INTO audit_logs (tenant_id,user_id,action,entity_type,entity_id,old_data,new_data,ip_address,user_agent)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
      [tenantId, userId, action, entityType, entityId,
       oldData ? JSON.stringify(oldData) : null,
       newData ? JSON.stringify(newData) : null,
       req?.ip || null,
       req?.headers?.['user-agent'] || null]
    );
  } catch (err) {
    logger.error('Audit log failed:', err.message);
  }
};
