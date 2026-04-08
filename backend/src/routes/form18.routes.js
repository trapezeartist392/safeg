const express      = require('express');
const router       = express.Router();
const { authenticate } = require('../middleware/auth');
const logger       = require('../utils/logger');
const { Pool }     = require('pg');
const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const FORM18_SCRIPT = path.join(__dirname, '../../../ai/form18_gen.py');
const FORM18_DIR    = path.join(__dirname, '../../../form18_reports');
if (!fs.existsSync(FORM18_DIR)) fs.mkdirSync(FORM18_DIR, { recursive: true });

router.post('/generate', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      violation_id, factory_name, factory_address, registration_no,
      industry_type, accident_date, accident_time, accident_location,
      shift, nature_of_injury, machine_involved, activity_at_time,
      cause_of_accident, severity, injured_name, age, sex,
      designation, department, employment_type, experience_years,
      body_part, first_aid_given, hospital_name, doctor_name,
      immediate_action_taken, corrective_action, preventive_action,
      action_target_date, manager_name, manager_designation,
      inspector_jurisdiction,
    } = req.body;

    let tenantInfo = {};
    try {
      const t = await pool.query('SELECT company_name, address, city, state FROM tenants WHERE id = $1', [tenantId]);
      if (t.rows.length > 0) tenantInfo = t.rows[0];
    } catch(e) { logger.warn('Tenant fetch failed:', e.message); }

    let violationsEvidence = [], ppe_violations = [], ai_confidence = 0, camera_id = '';
    if (violation_id) {
      try {
        const v = await pool.query('SELECT * FROM violations WHERE id = $1 AND tenant_id = $2', [violation_id, tenantId]);
        if (v.rows.length > 0) {
          ppe_violations = [v.rows[0].violation_type];
          ai_confidence  = v.rows[0].confidence;
          camera_id      = v.rows[0].camera_id;
          violationsEvidence = [{
            timestamp:  new Date(v.rows[0].detected_at).toLocaleString('en-IN'),
            type:       'No ' + v.rows[0].violation_type,
            confidence: v.rows[0].confidence,
            camera_id:  v.rows[0].camera_id,
            severity:   v.rows[0].severity || 'high',
          }];
        }
      } catch(e) { logger.warn('Violation fetch failed:', e.message); }
    }

    const reportNo   = 'FORM18-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6);
    const reportDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const outputPath = path.join(FORM18_DIR, reportNo + '.pdf');

    const formData = {
<<<<<<< Updated upstream
      factory_name: factory_name || tenantInfo.company_name || '',
      factory_address: factory_address || [tenantInfo.address, tenantInfo.city, tenantInfo.state].filter(Boolean).join(', '),
      registration_no, industry_type, accident_date, accident_time,
      accident_location, shift, nature_of_injury, machine_involved,
      activity_at_time, cause_of_accident, severity: severity || 'minor',
      injured_name, age, sex: sex || 'Male', designation, department,
      employment_type: employment_type || 'Permanent', experience_years,
      body_part, ppe_violations, ai_confidence, camera_id,
      violations_evidence: violationsEvidence,
      first_aid_given, hospital_name, doctor_name,
      immediate_action_taken, corrective_action, preventive_action,
      action_target_date,
      reported_by: 'SafeguardsIQ AI + ' + (manager_name || ''),
      manager_name, manager_designation: manager_designation || 'EHS Manager',
      inspector_jurisdiction, report_no: reportNo, report_date: reportDate,
    };

    const pyScript = `
=======
      factory_name:           factory_name || tenantInfo.company_name || '',
      factory_address:        factory_address || [tenantInfo.address, tenantInfo.city, tenantInfo.state].filter(Boolean).join(', '),
      registration_no,        industry_type,
      accident_date,          accident_time,
      accident_location,      shift,
      nature_of_injury,       machine_involved,
      activity_at_time,       cause_of_accident,
      severity:               severity || 'minor',
      injured_name,           age,
      sex:                    sex || 'Male',
      designation,            department,
      employment_type:        employment_type || 'Permanent',
      experience_years,       body_part,
      ppe_violations,         ai_confidence,
      camera_id,              violations_evidence: violationsEvidence,
      first_aid_given,        hospital_name,
      doctor_name,            immediate_action_taken,
      corrective_action,      preventive_action,
      action_target_date,
      reported_by:            'SafeguardsIQ AI + ' + (manager_name || ''),
      manager_name,           manager_designation: manager_designation || 'EHS Manager',
      inspector_jurisdiction, report_no: reportNo,
      report_date:            reportDate,
    };

    const dataFile  = path.join(FORM18_DIR, 'data_' + Date.now() + '.json');
    const tmpScript = path.join(FORM18_DIR, 'gen_'  + Date.now() + '.py');

    fs.writeFileSync(dataFile, JSON.stringify(formData));
    fs.writeFileSync(tmpScript, `
>>>>>>> Stashed changes
import sys, json
sys.path.insert(0, r'${path.dirname(FORM18_SCRIPT)}')
from form18_gen import generate_form18
<<<<<<< Updated upstream
data = json.loads(open('/tmp/form18_data_${Date.now()}.json').read())
=======
with open(r'${dataFile}') as f:
    data = json.load(f)
>>>>>>> Stashed changes
pdf = generate_form18(data)
with open(r'${outputPath}', 'wb') as f:
    f.write(pdf)
print('OK')
<<<<<<< Updated upstream
`;
    const dataFile  = '/tmp/form18_data_' + Date.now() + '.json';
    const tmpScript = '/tmp/form18_gen_' + Date.now() + '.py';
    fs.writeFileSync(dataFile, JSON.stringify(formData));

    const pyCode = `
import sys, json
sys.path.insert(0, '${path.dirname(FORM18_SCRIPT)}')
from form18_gen import generate_form18
with open('${dataFile}') as f:
    data = json.load(f)
pdf = generate_form18(data)
with open('${outputPath}', 'wb') as f:
    f.write(pdf)
print('OK')
`;
    fs.writeFileSync(tmpScript, pyCode);

    try {
      execSync('python3 ' + tmpScript, { timeout: 30000 });
      if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
      if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);

      if (!fs.existsSync(outputPath)) throw new Error('PDF not created');

      try {
        await pool.query(
          'INSERT INTO form18_reports (tenant_id, report_no, violation_id, file_path, factory_name, severity) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
          [tenantId, reportNo, violation_id || null, outputPath, formData.factory_name, formData.severity]
        );
      } catch(e) { logger.warn('DB insert failed:', e.message); }

      logger.info('Form 18 generated: ' + reportNo);
      const pdfBuffer = fs.readFileSync(outputPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + reportNo + '.pdf"');
      res.send(pdfBuffer);

    } catch(e) {
      if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
      if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
      throw new Error('PDF generation failed: ' + e.message);
    }

=======
`);

    try {
      execSync('python3 ' + tmpScript, { timeout: 30000 });
    } catch(e) {
      // Windows fallback
      execSync('python ' + tmpScript, { timeout: 30000 });
    }

    if (fs.existsSync(dataFile))  fs.unlinkSync(dataFile);
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);

    if (!fs.existsSync(outputPath)) throw new Error('PDF not created');

    try {
      await pool.query(
        'INSERT INTO form18_reports (tenant_id, report_no, violation_id, file_path, factory_name, severity) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [tenantId, reportNo, violation_id || null, outputPath, formData.factory_name, formData.severity]
      );
    } catch(e) { logger.warn('DB insert failed:', e.message); }

    logger.info('Form 18 generated: ' + reportNo);
    const pdfBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + reportNo + '.pdf"');
    res.send(pdfBuffer);

>>>>>>> Stashed changes
  } catch(error) {
    logger.error('Form18 error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/list', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT report_no, factory_name, severity, generated_at FROM form18_reports WHERE tenant_id = $1 ORDER BY generated_at DESC LIMIT 50',
      [req.user.tenantId]
    );
    res.json({ success: true, reports: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/download/:reportNo', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_path FROM form18_reports WHERE report_no = $1 AND tenant_id = $2',
      [req.params.reportNo, req.user.tenantId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const filePath = result.rows[0].file_path;
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File missing' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + req.params.reportNo + '.pdf"');
    res.send(fs.readFileSync(filePath));
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
