/**
 * violations.archive.routes.js — FIXED
 * Changes:
 *  1. Added LEFT JOIN areas to get area_name in response
 *  2. Removed detected_at alias — hook uses occurred_at directly now
 *  3. Removed hardcoded category:'ppe' — use real value from DB
 *  4. Added area_name, violation_no, occurred_at to response map
 *  5. Added violation_no to CSV export
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

const PLAN_LIMITS = { starter: 30, professional: 90, enterprise: 90 };

// GET /  — list violations with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const plan     = req.user.plan || 'starter';
    const maxDays  = PLAN_LIMITS[plan] || 30;

    const {
      page = 1, limit = 20, format,
      dateFrom, dateTo, category, severity, cameraId,
    } = req.query;

    const earliest   = new Date(Date.now() - maxDays * 86400000);
    const parsedFrom = dateFrom ? new Date(dateFrom).getTime() : NaN;
    const parsedTo   = dateTo   ? new Date(dateTo).getTime()   : NaN;
    const fromDate   = !Number.isNaN(parsedFrom) ? new Date(Math.max(parsedFrom, earliest.getTime())) : earliest;
    const toDate     = !Number.isNaN(parsedTo)   ? new Date(parsedTo + 24 * 60 * 60 * 1000 - 1)      : new Date();
    const pageNum    = Math.max(1, parseInt(page));
    const limitNum   = Math.min(parseInt(limit) || 20, 1000);
    const offset     = (pageNum - 1) * limitNum;

    // Use v. prefix since we're joining now
    const conditions = ['v.tenant_id = $1', 'v.occurred_at >= $2', 'v.occurred_at <= $3'];
    const params     = [tenantId, fromDate.toISOString(), toDate.toISOString()];
    let   idx        = 4;

    if (severity) { conditions.push(`v.severity = $${idx++}`);           params.push(severity); }
    if (cameraId) { conditions.push(`v.violation_cam ILIKE $${idx++}`);  params.push(`%${cameraId}%`); }
    if (category) { conditions.push(`v.category = $${idx++}`);           params.push(category); }

    const where = 'WHERE ' + conditions.join(' AND ');

    // CSV export
    if (format === 'csv') {
      const rows = await pool.query(
        `SELECT v.violation_no, v.occurred_at, v.violation_cam, v.violation_type,
                v.severity, v.confidence, v.description, v.corrective_action,
                a.area_name
         FROM violations v
         LEFT JOIN areas a ON a.id = v.area_id
         ${where}
         ORDER BY v.occurred_at DESC LIMIT ${limitNum}`,
        params
      );
      const headers = 'Violation No,Date,Time,Camera,Area,Violation,Severity,Confidence,Description\n';
      const csv = headers + rows.rows.map(r => {
        const dt = new Date(r.occurred_at);
        return [
          r.violation_no || '',
          dt.toLocaleDateString('en-IN'),
          dt.toLocaleTimeString('en-IN'),
          r.violation_cam || '',
          r.area_name || '',
          r.violation_type || '',
          r.severity || '',
          `${r.confidence || 0}%`,
          `"${(r.description || '').replace(/"/g, '""')}"`,
        ].join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition',
        `attachment; filename="violations_${fromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    // Count — needs same join for WHERE conditions to work
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM violations v
       LEFT JOIN areas a ON a.id = v.area_id
       ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    // Data — JOIN areas to get area_name
    const dataRes = await pool.query(
      `SELECT v.id, v.violation_no, v.occurred_at,
              v.violation_cam, v.camera_id, v.violation_type,
              v.category, v.severity, v.confidence,
              v.description, v.corrective_action, v.frame_url,
              v.status, v.plant_id, v.area_id, v.worker_id,
              a.area_name, a.zone_type
       FROM violations v
       LEFT JOIN areas a ON a.id = v.area_id
       ${where}
       ORDER BY v.occurred_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    // Map to frontend-expected shape
    // Hook uses: occurred_at, violation_no, violation_type, category,
    //            severity, confidence, corrective_action, status,
    //            area_name, camera_id, violation_cam, worker_id
    const violations = dataRes.rows.map(r => ({
      id:               r.id,
      violation_no:     r.violation_no,
      occurred_at:      r.occurred_at,       // hook reads this directly now
      camera_id:        r.camera_id || r.violation_cam, // real camera_id first, fallback to violation_cam
      violation_cam:    r.violation_cam,
      violation_type:   r.violation_type,
      category:         r.category || 'ppe', // real category from DB, not hardcoded
      severity:         r.severity,
      confidence:       r.confidence,
      description:      r.description,
      corrective_action: r.corrective_action,
      frame_url:        r.frame_url,
      status:           r.status,
      plant_id:         r.plant_id,
      area_id:          r.area_id,
      area_name:        r.area_name  || null, // from JOIN
      zone_type:        r.zone_type  || null,
      worker_id:        r.worker_id  || null,
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

  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /photo/:id
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
