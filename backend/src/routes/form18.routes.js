/**
 * SafeguardsIQ — Form 18 Generation Route
 * POST /api/v1/form18/generate — generates PDF from violation data
 * GET  /api/v1/form18/download/:id — download saved form
 * Place in: backend/src/routes/form18.routes.js
 */

const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/auth');
const logger     = require('../utils/logger');
const { Pool }   = require('pg');
const { execSync } = require('child_process');
const path       = require('path');
const fs         = require('fs');
const pool       = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Python Form 18 generator script path
const FORM18_SCRIPT = path.join(__dirname, '../../ai/form18_gen.py');
const FORM18_DIR    = path.join(__dirname, '../../form18_reports');

// Create output directory
if (!fs.existsSync(FORM18_DIR)) fs.mkdirSync(FORM18_DIR, { recursive: true });

/**
 * POST /api/v1/form18/generate
 * Generate Form 18 PDF from violation data
 */
router.post('/generate', auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      violation_id,     // optional — pre-fill from DB violation
      factory_name,
      factory_address,
      registration_no,
      industry_type,
      accident_date,
      accident_time,
      accident_location,
      shift,
      nature_of_injury,
      machine_involved,
      activity_at_time,
      cause_of_accident,
      severity,
      injured_name,
      age,
      sex,
      designation,
      department,
      employment_type,
      experience_years,
      body_part,
      first_aid_given,
      hospital_name,
      doctor_name,
      immediate_action_taken,
      corrective_action,
      preventive_action,
      action_target_date,
      manager_name,
      manager_designation,
      inspector_jurisdiction,
    } = req.body;

    // Get tenant/factory info
    let tenantInfo = {};
    try {
      const tResult = await pool.query(
        'SELECT company_name, address, city, state FROM tenants WHERE id = $1',
        [tenantId]
      );
      if (tResult.rows.length > 0) {
        tenantInfo = tResult.rows[0];
      }
    } catch (e) {
      logger.warn('Could not fetch tenant info:', e.message);
    }

    // Get violation evidence from DB if violation_id provided
    let violationsEvidence = [];
    let ppe_violations     = [];
    let ai_confidence      = 0;
    let camera_id          = '';

    if (violation_id) {
      try {
        const vResult = await pool.query(
          `SELECT violation_type, confidence, camera_id, detected_at, severity, description
           FROM violations
           WHERE tenant_id = $1
           AND detected_at >= NOW() - INTERVAL '24 hours'
           AND camera_id = (SELECT camera_id FROM violations WHERE id = $2)
           ORDER BY detected_at DESC LIMIT 10`,
          [tenantId, violation_id]
        );
        violationsEvidence = vResult.rows.map(v => ({
          timestamp:   new Date(v.detected_at).toLocaleString('en-IN'),
          type:        `No ${v.violation_type}`,
          confidence:  v.confidence,
          camera_id:   v.camera_id,
          severity:    v.severity || 'high',
        }));

        // Get main violation
        const mainV = await pool.query(
          'SELECT * FROM violations WHERE id = $1 AND tenant_id = $2',
          [violation_id, tenantId]
        );
        if (mainV.rows.length > 0) {
          const v        = mainV.rows[0];
          ppe_violations = [v.violation_type];
          ai_confidence  = v.confidence;
          camera_id      = v.camera_id;
        }
      } catch (e) {
        logger.warn('Could not fetch violations:', e.message);
      }
    }

    const reportNo  = `FORM18-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const reportDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const formData = {
      factory_name:           factory_name || tenantInfo.company_name || '',
      factory_address:        factory_address || `${tenantInfo.address || ''}, ${tenantInfo.city || ''}, ${tenantInfo.state || ''}`.trim().replace(/^,\s*|,\s*$/g,''),
      registration_no:        registration_no || '',
      industry_type:          industry_type || '',
      accident_date:          accident_date || new Date().toLocaleDateString('en-IN'),
      accident_time:          accident_time || '',
      accident_location:      accident_location || '',
      shift:                  shift || '',
      nature_of_injury:       nature_of_injury || '',
      machine_involved:       machine_involved || '',
      activity_at_time:       activity_at_time || '',
      cause_of_accident:      cause_of_accident || '',
      severity:               severity || 'minor',
      injured_name:           injured_name || '',
      age:                    age || '',
      sex:                    sex || 'Male',
      designation:            designation || '',
      department:             department || '',
      employment_type:        employment_type || 'Permanent',
      experience_years:       experience_years || '',
      body_part:              body_part || '',
      ppe_violations:         ppe_violations,
      ai_confidence:          ai_confidence,
      camera_id:              camera_id,
      violations_evidence:    violationsEvidence,
      first_aid_given:        first_aid_given || '',
      hospital_name:          hospital_name || '',
      doctor_name:            doctor_name || '',
      immediate_action_taken: immediate_action_taken || '',
      corrective_action:      corrective_action || '',
      preventive_action:      preventive_action || '',
      action_target_date:     action_target_date || '',
      reported_by:            'SafeguardsIQ AI System + ' + (manager_name || ''),
      manager_name:           manager_name || '',
      manager_designation:    manager_designation || 'EHS Manager',
      inspector_jurisdiction: inspector_jurisdiction || '',
      report_no:              reportNo,
      report_date:            reportDate,
    };

    // Call Python generator
    const dataJson   = JSON.stringify(formData).replace(/'/g, "\\'");
    const outputPath = path.join(FORM18_DIR, `${reportNo}.pdf`);

    const pyScript = `
import sys, json
sys.path.insert(0, '${path.dirname(FORM18_SCRIPT)}')
from form18_gen import generate_form18
data = json.loads('''${JSON.stringify(formData)}''')
pdf = generate_form18(data)
with open('${outputPath}', 'wb') as f:
    f.write(pdf)
print('OK')
`;
    const tmpScript = path.join(FORM18_DIR, `gen_${Date.now()}.py`);
    fs.writeFileSync(tmpScript, pyScript);

    try {
      const result = execSync(`python3 ${tmpScript}`, { timeout: 30000 }).toString().trim();
      fs.unlinkSync(tmpScript);

      if (!fs.existsSync(outputPath)) {
        throw new Error('PDF file not created');
      }

      // Save record to DB
      try {
        await pool.query(
          `INSERT INTO form18_reports (tenant_id, report_no, violation_id, file_path, generated_at, factory_name, severity)
           VALUES ($1, $2, $3, $4, NOW(), $5, $6)
           ON CONFLICT DO NOTHING`,
          [tenantId, reportNo, violation_id || null, outputPath,
           formData.factory_name, formData.severity]
        );
      } catch (e) {
        logger.warn('Could not save form18 record:', e.message);
      }

      logger.info(`Form 18 generated: ${reportNo} for tenant ${tenantId}`);

      // Stream PDF to client
      const pdfBuffer = fs.readFileSync(outputPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${reportNo}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);

    } catch (e) {
      if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
      throw new Error(`PDF generation failed: ${e.message}`);
    }

  } catch (error) {
    logger.error('Form 18 generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/form18/list
 * List all Form 18 reports for tenant
 */
router.get('/list', auth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const result   = await pool.query(
      `SELECT report_no, violation_id, factory_name, severity, generated_at
       FROM form18_reports
       WHERE tenant_id = $1
       ORDER BY generated_at DESC LIMIT 50`,
      [tenantId]
    );
    res.json({ success: true, reports: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/form18/download/:reportNo
 * Download existing Form 18 PDF
 */
router.get('/download/:reportNo', auth, async (req, res) => {
  try {
    const tenantId  = req.user.tenantId;
    const reportNo  = req.params.reportNo;
    const result    = await pool.query(
      'SELECT file_path FROM form18_reports WHERE report_no = $1 AND tenant_id = $2',
      [reportNo, tenantId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    const filePath = result.rows[0].file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    const pdfBuffer = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
