/**
 * compliance.routes.js
 * SafeguardsIQ — Form 18 filing + compliance report routes
 * Mount in app.js: app.use(`${v1}/compliance`, complianceRoutes);
 */
'use strict';

const express   = require('express');
const router    = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDB }        = require('../config/database');
const logger           = require('../utils/logger');

// POST /api/v1/compliance/form18 — file a Form 18 accident report
router.post('/form18', authenticate, async (req, res) => {
  try {
    const db       = getDB();
    const tenantId = req.user.tenantId;
    const {
      reportNo, factoryName, factoryRegNo,
      accidentDate, accidentTime, department,
      nature, description, immCause, rootCause,
      declarant, designation, filingDate, inspector,
      injured, capa, lastViolation, status,
    } = req.body;

    // Generate report number if not provided
    const year    = new Date().getFullYear();
    const no      = reportNo || `F18-${year}-${Math.floor(Math.random()*900)+100}`;

    // Check if form18_reports table exists, create if not
    await db.query(`
      CREATE TABLE IF NOT EXISTS form18_reports (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        report_no       TEXT NOT NULL,
        factory_name    TEXT,
        factory_reg_no  TEXT,
        accident_date   DATE,
        accident_time   TEXT,
        department      TEXT,
        nature          TEXT,
        description     TEXT,
        imm_cause       TEXT,
        root_cause      TEXT,
        declarant       TEXT,
        designation     TEXT,
        filing_date     DATE,
        inspector       TEXT,
        injured_persons JSONB DEFAULT '[]',
        capa_actions    JSONB DEFAULT '[]',
        ai_evidence     JSONB DEFAULT '{}',
        status          TEXT DEFAULT 'filed',
        filed_at        TIMESTAMPTZ DEFAULT NOW(),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows } = await db.query(`
      INSERT INTO form18_reports
        (tenant_id, report_no, factory_name, factory_reg_no,
         accident_date, accident_time, department, nature,
         description, imm_cause, root_cause,
         declarant, designation, filing_date, inspector,
         injured_persons, capa_actions, ai_evidence, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING id, report_no, filed_at
    `, [
      tenantId, no, factoryName, factoryRegNo,
      accidentDate || null, accidentTime, department, nature,
      description, immCause, rootCause,
      declarant, designation, filingDate || null, inspector,
      JSON.stringify(injured || []),
      JSON.stringify(capa    || []),
      JSON.stringify(lastViolation || {}),
      status || 'filed',
    ]);

    const report = rows[0];
    logger.info(`[FORM18] Filed: ${report.report_no} by tenant ${tenantId}`);

    res.json({
      success: true,
      message: `Form 18 ${report.report_no} filed successfully`,
      data: {
        reportNo: report.report_no,
        id:       report.id,
        filedAt:  report.filed_at,
      }
    });
  } catch (err) {
    logger.error('Form 18 filing error: ' + err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/compliance/form18 — list all filed Form 18s for tenant
router.get('/form18', authenticate, async (req, res) => {
  try {
    const db = getDB();
    const { rows } = await db.query(`
      SELECT id, report_no, factory_name, accident_date,
             nature, declarant, status, filed_at
      FROM form18_reports
      WHERE tenant_id = $1
      ORDER BY filed_at DESC
      LIMIT 50
    `, [req.user.tenantId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    // Table may not exist yet
    res.json({ success: true, data: [] });
  }
});

// GET /api/v1/compliance/form18/:id — get single Form 18
router.get('/form18/:id', authenticate, async (req, res) => {
  try {
    const db = getDB();
    const { rows } = await db.query(`
      SELECT * FROM form18_reports
      WHERE id = $1 AND tenant_id = $2
    `, [req.params.id, req.user.tenantId]);

    if (!rows.length) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
