/**
 * violations.archive.routes.js
 * SafeguardsIQ — Violation Archive API
 * GET /api/v1/violations/archive       — paginated, filtered, CSV export
 * GET /api/v1/violations/archive/photo/:id — get evidence photo
 * Place in: backend/src/routes/violations.archive.routes.js
 * Mount BEFORE violation.routes.js in app.js:
 *   app.use(`${v1}/violations/archive`, archiveRoutes);
 *   app.use(`${v1}/violations`, violationRoutes);
 */
const express      = require('express');
const router       = express.Router();
const { authenticate } = require('../middleware/auth');
const { Pool }     = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const PLAN_LIMITS = { starter:30, professional:90, enterprise:90 };

// GET /  — list violations with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const plan     = req.user.plan || 'starter';
    const maxDays  = PLAN_LIMITS[plan] || 30;

    const {
      page=1, limit=20, format,
      dateFrom, dateTo, category, severity, cameraId,
    } = req.query;

    const earliest = new Date(Date.now() - maxDays * 86400000);
    const fromDate = dateFrom ? new Date(Math.max(new Date(dateFrom), earliest)) : earliest;
    const toDate   = dateTo   ? new Date(dateTo) : new Date();
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(parseInt(limit) || 20, 1000);
    const offset   = (pageNum - 1) * limitNum;

    const conditions = ['tenant_id = $1', 'occurred_at >= $2', 'occurred_at <= $3'];
    const params     = [tenantId, fromDate.toISOString(), toDate.toISOString()];
    let   idx        = 4;

    if (severity) { conditions.push(`severity = $${idx++}`);          params.push(severity); }
    if (cameraId) { conditions.push(`camera_id ILIKE $${idx++}`);     params.push(`%${cameraId}%`); }

    const where = 'WHERE ' + conditions.join(' AND ');

    // CSV export
    if (format === 'csv') {
      const rows = await pool.query(
        `SELECT occurred_at, camera_id, violation_type, severity,
                confidence, description, corrective_action
         FROM violations ${where}
         ORDER BY occurred_at DESC LIMIT ${limitNum}`,
        params
      );
      const headers = 'Date,Time,Camera,Violation,Severity,Confidence,Description\n';
      const csv = headers + rows.rows.map(r => {
        const dt = new Date(r.occurred_at);
        return [
          dt.toLocaleDateString('en-IN'),
          dt.toLocaleTimeString('en-IN'),
          r.camera_id,
          r.violation_type,
          r.severity,
          `${r.confidence || 0}%`,
          `"${(r.description || '').replace(/"/g, '""')}"`,
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
      `SELECT id, occurred_at, camera_id, violation_type, severity,
              confidence, description, corrective_action, frame_url,
              status, plant_id, area_id
       FROM violations ${where}
       ORDER BY occurred_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    // Map columns to what the frontend expects
    const violations = dataRes.rows.map(r => ({
      id:               r.id,
      detected_at:      r.occurred_at,
      camera_id:        r.camera_id,
      violation_type:   r.violation_type,
      category:         'ppe',
      severity:         r.severity,
      confidence:       r.confidence,
      description:      r.description,
      immediate_action: r.corrective_action,
      frame_url:        r.frame_url,
      status:           r.status,
      plant_id:         r.plant_id,
      area_id:          r.area_id,
    }));

    res.json({
      success: true,
      data: {
        violations,
        total,
        page:       pageNum,
        totalPages: Math.ceil(total / limitNum),
        dateRange:  { from: fromDate, to: toDate },
        maxDays,
        plan,
      }
    });

  } catch(error) {
    console.error('Archive error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /photo/:id — get evidence photo for a violation
router.get('/photo/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT frame_url, violation_type, occurred_at
       FROM violations WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenantId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const row = result.rows[0];
    if (!row.frame_url) {
      return res.status(404).json({ success: false, message: 'No photo available' });
    }
    res.json({
      success:     true,
      image:       row.frame_url,
      type:        row.violation_type,
      detected_at: row.occurred_at,
    });
  } catch(error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
