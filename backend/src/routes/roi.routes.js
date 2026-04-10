/**
 * roi.routes.js
 * SafeguardsIQ — ROI Report Generation
 * POST /api/v1/roi/report — generates ROI PDF
 * Place in: backend/src/routes/roi.routes.js
 */
const express      = require('express');
const router       = express.Router();
const { authenticate } = require('../middleware/auth');
const logger       = require('../utils/logger');
const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

const SCRIPT_DIR = path.join(__dirname, '../../../ai');
const REPORT_DIR = path.join(__dirname, '../../../roi_reports');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

router.post('/report', authenticate, async (req, res) => {
  try {
    const {
      factory_name, workers, cameras, plan,
      accidents_year, cost_per_accident, reduction_rate,
      plan_price_per_camera, manager_name, pilot_results,
    } = req.body;

    const reportId   = `ROI-${Date.now().toString().slice(-8)}`;
    const outputPath = path.join(REPORT_DIR, `${reportId}.pdf`);
    const dataFile   = path.join(REPORT_DIR, `data_${Date.now()}.json`);
    const tmpScript  = path.join(REPORT_DIR, `gen_${Date.now()}.py`);

    const formData = {
      factory_name:         factory_name || '',
      workers:              parseInt(workers) || 100,
      cameras:              parseInt(cameras) || 8,
      plan:                 plan || 'Professional',
      accidents_year:       parseInt(accidents_year) || 8,
      cost_per_accident:    parseInt(cost_per_accident) || 1500000,
      reduction_rate:       parseFloat(reduction_rate) || 0.40,
      plan_price_per_camera:parseInt(plan_price_per_camera) || 2000,
      manager_name:         manager_name || '',
      pilot_results:        pilot_results || {},
    };

    fs.writeFileSync(dataFile, JSON.stringify(formData));
    fs.writeFileSync(tmpScript, `
import sys, json
sys.path.insert(0, r'${SCRIPT_DIR}')
from roi_report import generate_roi_report
with open(r'${dataFile}') as f:
    data = json.load(f)
pdf = generate_roi_report(data)
with open(r'${outputPath}', 'wb') as f:
    f.write(pdf)
print('OK')
`);

    try {
      execSync(`python3 ${tmpScript}`, { timeout: 30000 });
    } catch {
      execSync(`python ${tmpScript}`, { timeout: 30000 });
    }

    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);

    if (!fs.existsSync(outputPath)) throw new Error('PDF not created');

    logger.info(`ROI Report generated: ${reportId}`);
    const pdfBuffer = fs.readFileSync(outputPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportId}.pdf"`);
    res.send(pdfBuffer);

  } catch(error) {
    logger.error('ROI report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
