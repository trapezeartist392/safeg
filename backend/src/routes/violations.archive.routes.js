/**
 * violations.archive.routes.js
 * SafeguardsIQ — Violation Archive API
 * GET /api/v1/violations/archive — paginated, filtered, CSV export
 * Place in: backend/src/routes/violations.archive.routes.js
 */
const express      = require('express');
const router       = express.Router();
const { authenticate } = require('../middleware/auth');
const { Pool }     = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Plan-based day limits
const PLAN_LIMITS = { starter: 30, professional: 90, enterprise: 90 };

router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const plan     = req.user.plan || 'starter';
    const maxDays  = PLAN_LIMITS[plan] || 30;

    const {
      page = 1, limit = 20, format,
      dateFrom, dateTo, category, severity, cameraId,
    } = req.query;

    // Enforce plan-based date limit
    const earliest  = new Date(Date.now() - maxDays * 86400000);
    const fromDate  = dateFrom ? new Date(Math.max(new Date(dateFrom), earliest)) : earliest;
    const toDate    = dateTo   ? new Date(dateTo) : new Date();
    const pageNum   = Math.max(1, parseInt(page));
    const limitNum  = Math.min(parseInt(limit) || 20, 1000);
    const offset    = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions = ['tenant_id = $1', 'detected_at >= $2', 'detected_at <= $3'];
    const params     = [tenantId, fromDate.toISOString(), toDate.toISOString()];
    let   idx        = 4;

    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    if (severity) { conditions.push(`severity = $${idx++}`); params.push(severity); }
    if (cameraId) { conditions.push(`camera_id ILIKE $${idx++}`); params.push(`%${cameraId}%`); }

    const where = 'WHERE ' + conditions.join(' AND ');

    // CSV export
    if (format === 'csv') {
      const rows = await pool.query(
        `SELECT detected_at, camera_id, category, violation_type, severity,
                confidence, description, immediate_action, plant_id, area_id
         FROM violations ${where}
         ORDER BY detected_at DESC LIMIT ${limitNum}`,
        params
      );

      const headers = 'Date,Time,Camera,Category,Violation,Severity,Confidence,Description,Action\n';
      const csv = headers + rows.rows.map(r => {
        const dt = new Date(r.detected_at);
        return [
          dt.toLocaleDateString('en-IN'),
          dt.toLocaleTimeString('en-IN'),
          r.camera_id, r.category, r.violation_type, r.severity,
          `${r.confidence}%`,
          `"${(r.description||'').replace(/"/g,'""')}"`,
          `"${(r.immediate_action||'').replace(/"/g,'""')}"`,
        ].join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition',
        `attachment; filename="violations_${fromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    // Count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM violations ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    // Data
    const dataRes = await pool.query(
      `SELECT id, detected_at, camera_id, category, violation_type, severity,
              confidence, description, immediate_action, plant_id, area_id, source
       FROM violations ${where}
       ORDER BY detected_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    // Summary stats
    const statsRes = await pool.query(
      `SELECT category, COUNT(*) as count, AVG(confidence) as avg_conf
       FROM violations ${where}
       GROUP BY category`,
      params
    );

    res.json({
      success: true,
      data: {
        violations: dataRes.rows,
        total,
        page:       pageNum,
        totalPages: Math.ceil(total / limitNum),
        dateRange:  { from: fromDate, to: toDate },
        maxDays,
        plan,
        stats:      statsRes.rows,
      }
    });

  } catch(error) {
    console.error('Archive error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
