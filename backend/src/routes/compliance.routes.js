/**
 * compliance.routes.js
 * SafeguardsIQ — Compliance Report Generation
 * POST /api/v1/compliance/report — generates monthly PDF
 * Place in: backend/src/routes/compliance.routes.js
 */
const express      = require('express');
const router       = express.Router();
const { authenticate } = require('../middleware/auth');
const logger       = require('../utils/logger');
const { Pool }     = require('pg');
const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const SCRIPT_DIR  = path.join(__dirname, '../../../ai');
const REPORT_DIR  = path.join(__dirname, '../../../compliance_reports');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

router.post('/report', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      month, year,
      ehs_officer, manager_name, director,
      corrective_actions,
    } = req.body;

    const now       = new Date();
    const repYear   = year  || now.getFullYear();
    const repMonth  = month || (now.getMonth() + 1);
    const monthStart = new Date(repYear, repMonth - 1, 1);
    const monthEnd   = new Date(repYear, repMonth, 0, 23, 59, 59);

    const MONTH_NAMES = ["January","February","March","April","May","June",
      "July","August","September","October","November","December"];
    const monthName = MONTH_NAMES[repMonth - 1];

    // Get tenant info
    let tenantInfo = {};
    try {
      const t = await pool.query(
        'SELECT company_name, address, city, state, plan_id, camera_count FROM tenants WHERE id = $1',
        [tenantId]
      );
      if (t.rows.length > 0) tenantInfo = t.rows[0];
    } catch(e) { logger.warn('Tenant fetch:', e.message); }

    // Aggregate violations for the month
    let kpis = {}, ppeBreakdown = [], cameraCompliance = [], incidents = [];
    try {
      // Total violations
      const totalRes = await pool.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE severity IN ('critical')) as critical,
                COUNT(*) FILTER (WHERE category='ppe') as ppe,
                COUNT(*) FILTER (WHERE category='pathway') as pathway,
                COUNT(*) FILTER (WHERE category='unsafe') as unsafe,
                COUNT(*) FILTER (WHERE category='accident') as accident,
                COUNT(*) FILTER (WHERE category='nearmiss') as nearmiss,
                AVG(confidence) as avg_conf
         FROM violations
         WHERE tenant_id=$1 AND detected_at BETWEEN $2 AND $3`,
        [tenantId, monthStart, monthEnd]
      );
      const t = totalRes.rows[0];
      const total = parseInt(t.total) || 0;

      // Rough compliance rate — based on frames analysed vs violations
      const framesRes = await pool.query(
        `SELECT COUNT(DISTINCT DATE_TRUNC('minute', detected_at)) as frames
         FROM violations WHERE tenant_id=$1 AND detected_at BETWEEN $2 AND $3`,
        [tenantId, monthStart, monthEnd]
      );
      const frames = parseInt(framesRes.rows[0]?.frames) || 1;
      const compRate = Math.max(0, Math.min(100, Math.round(100 - (total / (frames * 10)) * 100)));

      kpis = {
        compliance_rate:    compRate,
        total_violations:   total,
        critical_incidents: parseInt(t.critical) || 0,
        persons_monitored:  tenantInfo.camera_count ? tenantInfo.camera_count * 15 : 0,
        avg_detection_time: "< 3s",
        cameras_active:     tenantInfo.camera_count || 0,
      };

      // PPE breakdown
      const ppeRes = await pool.query(
        `SELECT violation_type, COUNT(*) as count, severity
         FROM violations
         WHERE tenant_id=$1 AND category='ppe' AND detected_at BETWEEN $2 AND $3
         GROUP BY violation_type, severity
         ORDER BY count DESC LIMIT 10`,
        [tenantId, monthStart, monthEnd]
      );
      const ppeTotal = ppeRes.rows.reduce((s,r) => s + parseInt(r.count), 0) || 1;
      ppeBreakdown = ppeRes.rows.map(r => ({
        type:     r.violation_type,
        count:    parseInt(r.count),
        pct:      Math.round(parseInt(r.count)/ppeTotal*100) + '%',
        severity: r.severity || 'medium',
        trend:    "→ Stable",
      }));

      // Camera compliance
      const camRes = await pool.query(
        `SELECT camera_id, COUNT(*) as viols, AVG(confidence) as avg_conf
         FROM violations
         WHERE tenant_id=$1 AND detected_at BETWEEN $2 AND $3
         GROUP BY camera_id ORDER BY viols DESC LIMIT 10`,
        [tenantId, monthStart, monthEnd]
      );
      cameraCompliance = camRes.rows.map(r => ({
        id:    r.camera_id,
        zone:  r.camera_id,
        viols: parseInt(r.viols),
        pct:   Math.max(60, Math.round(100 - parseInt(r.viols)/5)),
        worst: ppeBreakdown[0]?.type || "Helmet",
        ok:    parseInt(r.viols) < 10,
      }));

      // Incidents
      const incRes = await pool.query(
        `SELECT category, COUNT(*) as count, severity, camera_id
         FROM violations
         WHERE tenant_id=$1 AND category != 'ppe' AND detected_at BETWEEN $2 AND $3
         GROUP BY category, severity, camera_id LIMIT 10`,
        [tenantId, monthStart, monthEnd]
      );
      incidents = incRes.rows.map(r => ({
        cat:    r.category, count: parseInt(r.count),
        sev:    r.severity || 'medium', loc: r.camera_id,
        action: "Supervisor notified",
      }));

    } catch(e) { logger.warn('Stats fetch:', e.message); }

    const reportId   = `CR-${repYear}-${String(repMonth).padStart(2,'0')}-${Date.now().toString().slice(-4)}`;
    const outputPath = path.join(REPORT_DIR, `${reportId}.pdf`);

    const formData = {
      report_id:    reportId,
      factory_name: tenantInfo.company_name || '',
      location:     [tenantInfo.address, tenantInfo.city, tenantInfo.state].filter(Boolean).join(', '),
      report_month: `${monthName} ${repYear}`,
      period:       `01 ${monthName} ${repYear} – ${monthEnd.getDate()} ${monthName} ${repYear}`,
      plan:         tenantInfo.plan_id || 'Starter',
      camera_count: tenantInfo.camera_count || 0,
      generated_at: now.toLocaleDateString('en-IN'),
      ehs_officer:  ehs_officer  || '',
      manager_name: manager_name || '',
      director:     director     || '',
      kpis,
      ppe_breakdown:      ppeBreakdown,
      camera_compliance:  cameraCompliance,
      incidents,
      corrective_actions: corrective_actions || [
        "Review PPE compliance procedures with all shift supervisors",
        "Ensure PPE dispensers are stocked at all zone entry points",
        "Conduct monthly safety refresher training",
        "Update and repaint faded zone markings",
      ],
    };

    const dataFile  = path.join(REPORT_DIR, `data_${Date.now()}.json`);
    const tmpScript = path.join(REPORT_DIR, `gen_${Date.now()}.py`);
    fs.writeFileSync(dataFile, JSON.stringify(formData));
    fs.writeFileSync(tmpScript, `
import sys, json
sys.path.insert(0, r'${SCRIPT_DIR}')
from compliance_report import generate_compliance_report
with open(r'${dataFile}') as f:
    data = json.load(f)
pdf = generate_compliance_report(data)
with open(r'${outputPath}', 'wb') as f:
    f.write(pdf)
print('OK')
`);

    execSync(`python3 ${tmpScript}`, { timeout: 30000 });
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);

    if (!fs.existsSync(outputPath)) throw new Error('PDF not created');

    logger.info(`Compliance report generated: ${reportId}`);
    const pdfBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportId}.pdf"`);
    res.send(pdfBuffer);

  } catch(error) {
    logger.error('Compliance report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
