/** FORM 18 ROUTES **/
const f18Router   = require('express').Router();
const dashRouter  = require('express').Router();
const wbRouter    = require('express').Router();
const inspRouter  = require('express').Router();
const rptRouter   = require('express').Router();
const alertRouter = require('express').Router();
const userRouter  = require('express').Router();
const healthRouter = require('express').Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate    = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { getDB }   = require('../config/database');
const { cache }   = require('../config/redis');
const AppError    = require('../utils/AppError');

// ══════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════
healthRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDB();
  try { await db.query('SELECT 1'); } catch { throw new AppError('DB down', 503); }
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), service: 'safeg-ai-backend' });
}));
module.exports.healthRoutes = healthRouter;

// ══════════════════════════════════════════════════════
// FORM 18
// ══════════════════════════════════════════════════════
f18Router.use(authenticate);

f18Router.get('/', asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const where = ['f.tenant_id = $1']; const params = [req.user.tenantId]; let p = 2;
  if (plantId) { where.push(`f.plant_id = $${p++}`); params.push(plantId); }
  if (status)  { where.push(`f.status = $${p++}`);   params.push(status); }
  params.push(parseInt(limit), offset);
  const { rows } = await db.query(
    `SELECT f.*, p.plant_name FROM form18_reports f
     LEFT JOIN plants p ON p.id = f.plant_id
     WHERE ${where.join(' AND ')}
     ORDER BY f.created_at DESC LIMIT $${p++} OFFSET $${p++}`,
    params
  );
  res.json({ success: true, data: rows });
}));

f18Router.post('/', asyncHandler(async (req, res) => {
  const db = getDB();
  const d = req.body;
  const { rows } = await db.query(
    `INSERT INTO form18_reports
      (tenant_id, plant_id, violation_id,
       factory_name, factory_reg_no, industry_type, factory_address, district, state,
       occupier_name, manager_name, contact_number,
       accident_date, accident_time, department, nature_of_accident, operation_performed,
       description, immediate_cause, root_cause,
       injured_persons,
       first_aid_given, hospital_referred, esic_member, medical_officer, medical_exam_date,
       ai_camera_id, ai_timestamp, ai_confidence, ai_alert_sent_to, ai_response_time_sec, video_clip_url, ai_analysis,
       capa_actions,
       declarant_name, declarant_desig, filing_date, inspector_office)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
             $21::jsonb,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34::jsonb,$35,$36,$37,$38)
     RETURNING *`,
    [req.user.tenantId, d.plantId, d.violationId,
     d.factoryName, d.factoryRegNo, d.industryType, d.factoryAddress, d.district, d.state,
     d.occupierName, d.managerName, d.contactNumber,
     d.accidentDate, d.accidentTime, d.department, d.natureOfAccident, d.operationPerformed,
     d.description, d.immCause, d.rootCause,
     JSON.stringify(d.injuredPersons || []),
     d.firstAid, d.hospital, d.esic, d.doctor, d.medDate,
     d.aiCameraId, d.aiTimestamp, d.aiConfidence, d.aiAlertSentTo, d.aiResponseTime, d.videoClipUrl, d.aiAnalysis,
     JSON.stringify(d.capaActions || []),
     d.declarant, d.designation, d.filingDate, d.inspector]
  );
  res.status(201).json({ success: true, data: rows[0] });
}));

f18Router.get('/:id', param('id').isUUID(), validate, asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    'SELECT * FROM form18_reports WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenantId]);
  if (!rows.length) throw new AppError('Form 18 not found', 404);
  res.json({ success: true, data: rows[0] });
}));

f18Router.put('/:id', param('id').isUUID(), validate, asyncHandler(async (req, res) => {
  const db = getDB();
  const d = req.body;
  const allowed = ['factory_name','factory_reg_no','occupier_name','manager_name',
    'accident_date','accident_time','department','nature_of_accident','description',
    'immediate_cause','root_cause','first_aid_given','hospital_referred','declarant_name',
    'declarant_desig','filing_date','status'];
  const sets=[]; const vals=[]; let p=1;
  for(const [k,v] of Object.entries(d)){
    const col=k.replace(/([A-Z])/g,'_$1').toLowerCase();
    if(allowed.includes(col)){sets.push(`${col}=$${p++}`);vals.push(v);}
  }
  if(d.injuredPersons) { sets.push(`injured_persons=$${p++}::jsonb`); vals.push(JSON.stringify(d.injuredPersons)); }
  if(d.capaActions)    { sets.push(`capa_actions=$${p++}::jsonb`);     vals.push(JSON.stringify(d.capaActions)); }
  vals.push(req.params.id, req.user.tenantId);
  const { rows } = await db.query(
    `UPDATE form18_reports SET ${sets.join(',')} WHERE id=$${p++} AND tenant_id=$${p++} RETURNING *`, vals);
  if (!rows.length) throw new AppError('Not found', 404);
  res.json({ success: true, data: rows[0] });
}));

f18Router.post('/:id/submit', param('id').isUUID(), validate, asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `UPDATE form18_reports SET status='submitted', submitted_at=NOW() WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tenantId]);
  if (!rows.length) throw new AppError('Not found', 404);
  res.json({ success: true, data: rows[0], message: 'Form 18 submitted to Inspector portal' });
}));

module.exports.form18Routes = f18Router;

// ══════════════════════════════════════════════════════
// DASHBOARD  (aggregated KPIs — Redis cached)
// ══════════════════════════════════════════════════════
dashRouter.use(authenticate);

dashRouter.get('/overview', asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId } = req.query;
  const cacheKey = `dashboard:${req.user.tenantId}:${plantId || 'all'}`;

  const data = await cache.getOrSet(cacheKey, async () => {
    const where = ['tenant_id = $1']; const params = [req.user.tenantId]; let p = 2;
    if (plantId) { where.push(`id = $${p++}`); params.push(plantId); }
    const { rows } = await db.query(`SELECT * FROM v_dashboard_summary WHERE ${where.join(' AND ')}`, params);
    return rows;
  }, 30); // 30 second TTL

  res.json({ success: true, data });
}));

dashRouter.get('/kpis', asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId } = req.query;
  const where = ['v.tenant_id = $1']; const params = [req.user.tenantId]; let p = 2;
  if (plantId) { where.push(`v.plant_id = $${p++}`); params.push(plantId); }

  const [viol, ppe, cams] = await Promise.all([
    db.query(`SELECT COUNT(*) FILTER (WHERE status='open') AS open_violations,
                     COUNT(*) FILTER (WHERE occurred_at >= NOW()-INTERVAL '24h') AS today
              FROM violations v WHERE ${where.join(' AND ')}`, params),
    db.query(`SELECT ROUND(COUNT(*) FILTER (WHERE NOT is_violation)::DECIMAL / NULLIF(COUNT(*),0)*100,1) AS pct
              FROM ppe_events WHERE tenant_id=$1 AND detected_at >= NOW()-INTERVAL '24h'
              ${plantId?'AND plant_id=$2':''}`, params.slice(0,plantId?2:1)),
    db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='online') AS online
              FROM cameras WHERE tenant_id=$1 ${plantId?'AND plant_id=$2':''}`, params.slice(0,plantId?2:1)),
  ]);

  res.json({ success: true, data: {
    violations:     viol.rows[0],
    ppeCompliance:  ppe.rows[0]?.pct || 0,
    cameras:        cams.rows[0],
  }});
}));

dashRouter.get('/timeline', asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, hours = 24 } = req.query;
  const where = ['v.tenant_id = $1', `v.occurred_at >= NOW()-INTERVAL '${parseInt(hours)} hours'`];
  const params = [req.user.tenantId]; let p = 2;
  if (plantId) { where.push(`v.plant_id = $${p++}`); params.push(plantId); }
  const { rows } = await db.query(
    `SELECT v.id, v.violation_no, v.violation_type, v.severity, v.status,
            v.occurred_at, v.cam_label, a.area_name, p.plant_name
     FROM violations v
     LEFT JOIN areas a ON a.id = v.area_id LEFT JOIN plants p ON p.id = v.plant_id
     WHERE ${where.join(' AND ')} ORDER BY v.occurred_at DESC LIMIT 50`, params);
  res.json({ success: true, data: rows });
}));

dashRouter.get('/ppe-trend', asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, days = 7 } = req.query;
  const params = [req.user.tenantId, parseInt(days)]; let p = 3;
  const plantFilter = plantId ? `AND plant_id = $${p++}` : '';
  if (plantId) params.push(plantId);
  const { rows } = await db.query(
    `SELECT DATE_TRUNC('day', detected_at) AS day,
            COUNT(*) AS total_detections,
            COUNT(*) FILTER (WHERE is_violation) AS violations,
            ROUND(COUNT(*) FILTER (WHERE NOT is_violation)::DECIMAL / NULLIF(COUNT(*),0)*100,1) AS compliance_pct
     FROM ppe_events
     WHERE tenant_id=$1 AND detected_at >= NOW()-($2||' days')::INTERVAL ${plantFilter}
     GROUP BY day ORDER BY day`, params);
  res.json({ success: true, data: rows });
}));

module.exports.dashboardRoutes = dashRouter;

// ══════════════════════════════════════════════════════
// INSPECTION
// ══════════════════════════════════════════════════════
inspRouter.use(authenticate);

inspRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT s.*, p.plant_name, u.full_name AS conducted_by_name
     FROM inspection_sessions s LEFT JOIN plants p ON p.id=s.plant_id
     LEFT JOIN users u ON u.id=s.conducted_by
     WHERE s.tenant_id=$1 ORDER BY s.session_date DESC LIMIT 50`, [req.user.tenantId]);
  res.json({ success: true, data: rows });
}));

inspRouter.post('/', asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, shift, items = [] } = req.body;
  const session = await db.query(
    `INSERT INTO inspection_sessions (tenant_id,plant_id,shift,conducted_by,total_items)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.tenantId, plantId, shift, req.user.id, items.length]
  );
  const sid = session.rows[0].id;
  for (const item of items) {
    await db.query(
      `INSERT INTO inspection_items (session_id,category,item_text,result,notes) VALUES ($1,$2,$3,$4,$5)`,
      [sid, item.category, item.itemText, item.result, item.notes]
    );
  }
  res.status(201).json({ success: true, data: session.rows[0] });
}));

inspRouter.put('/:id/sign-off', param('id').isUUID(), validate, asyncHandler(async (req, res) => {
  const db = getDB();
  const stats = await db.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE result='pass') AS passed,
            COUNT(*) FILTER (WHERE result='fail') AS failed
     FROM inspection_items WHERE session_id=$1`, [req.params.id]);
  const { total, passed, failed } = stats.rows[0];
  const score = total > 0 ? Math.round(passed/total*100) : 0;
  const { rows } = await db.query(
    `UPDATE inspection_sessions SET status='signed_off', signed_off_by=$1, signed_off_at=NOW(),
     passed=$2, failed=$3, score_pct=$4, total_items=$5
     WHERE id=$6 AND tenant_id=$7 RETURNING *`,
    [req.user.id, passed, failed, score, total, req.params.id, req.user.tenantId]);
  res.json({ success: true, data: rows[0] });
}));

module.exports.inspectionRoutes = inspRouter;

// ══════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════
rptRouter.use(authenticate);

rptRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT r.*, p.plant_name, u.full_name AS generated_by_name
     FROM reports r LEFT JOIN plants p ON p.id=r.plant_id LEFT JOIN users u ON u.id=r.generated_by
     WHERE r.tenant_id=$1 ORDER BY r.created_at DESC`, [req.user.tenantId]);
  res.json({ success: true, data: rows });
}));

rptRouter.post('/generate', asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, reportType, periodStart, periodEnd } = req.body;
  const titles = {
    iso_45001:        'ISO 45001 OHS Management Report',
    esic:             'ESIC Half-Yearly Return',
    brsr:             'SEBI BRSR Safety Data Report',
    accident_summary: 'Accident & Incident Summary',
    monthly_ppe:      'Monthly PPE Compliance Report',
    weekly_violations:'Weekly Violation Summary',
    osh_code:         'OSH Code 2020 Compliance Report',
  };
  const { rows } = await db.query(
    `INSERT INTO reports (tenant_id,plant_id,report_type,title,period_start,period_end,generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.tenantId, plantId, reportType, titles[reportType]||reportType, periodStart, periodEnd, req.user.id]);
  res.status(201).json({ success: true, data: rows[0], message: 'Report queued for generation' });
}));

module.exports.reportRoutes = rptRouter;

// ══════════════════════════════════════════════════════
// ALERTS
// ══════════════════════════════════════════════════════
alertRouter.use(authenticate);
alertRouter.get('/', asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT al.*, v.violation_no, v.violation_type FROM alert_logs al
     LEFT JOIN violations v ON v.id=al.violation_id
     WHERE al.tenant_id=$1 ORDER BY al.sent_at DESC LIMIT 100`, [req.user.tenantId]);
  res.json({ success: true, data: rows });
}));
module.exports.alertRoutes = alertRouter;

// ══════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════
userRouter.use(authenticate);
userRouter.get('/', authorize('superadmin','customer_admin','plant_manager'), asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT id,email,full_name,designation,department,mobile,role,is_active,last_login_at,created_at
     FROM users WHERE tenant_id=$1 ORDER BY created_at DESC`, [req.user.tenantId]);
  res.json({ success: true, data: rows });
}));

userRouter.post('/', authorize('superadmin','customer_admin'), [
  body('email').isEmail().normalizeEmail(),
  body('fullName').notEmpty(),
  body('role').isIn(['customer_admin','plant_manager','hse_officer','operator','viewer']),
  body('password').isLength({min:8}),
], validate, asyncHandler(async (req, res) => {
  const bcrypt = require('bcryptjs');
  const db = getDB();
  const { email, fullName, designation, department, mobile, role, password, plantIds } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await db.query(
    `INSERT INTO users (tenant_id,email,password_hash,full_name,designation,department,mobile,role,plant_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,email,full_name,role`,
    [req.user.tenantId, email, hash, fullName, designation, department, mobile, role, plantIds]);
  res.status(201).json({ success: true, data: rows[0] });
}));

userRouter.put('/:id', param('id').isUUID(), validate, asyncHandler(async (req, res) => {
  const db = getDB();
  const allowed = ['full_name','designation','department','mobile','role','plant_ids','is_active'];
  const sets=[]; const vals=[]; let p=1;
  for(const [k,v] of Object.entries(req.body)){
    const col=k.replace(/([A-Z])/g,'_$1').toLowerCase();
    if(allowed.includes(col)){sets.push(`${col}=$${p++}`);vals.push(v);}
  }
  vals.push(req.params.id, req.user.tenantId);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(',')} WHERE id=$${p++} AND tenant_id=$${p++} RETURNING id,email,full_name,role`,vals);
  if(!rows.length) throw new AppError('User not found',404);
  res.json({ success: true, data: rows[0] });
}));

module.exports.userRoutes = userRouter;

// ══════════════════════════════════════════════════════
// WEBHOOK (inbound from AI engine)
// ══════════════════════════════════════════════════════
wbRouter.post('/ai-detection', asyncHandler(async (req, res) => {
  // Validate internal API key
  if (req.headers['x-api-key'] !== process.env.AI_API_KEY)
    throw new AppError('Unauthorised', 401);

  const { cameraId, tenantId, plantId, areaId, camLabel,
          eventType, isViolation, confidence, frameUrl, workerBbox, shift } = req.body;

  const db = getDB();

  // Insert raw PPE event (high volume — fast insert)
  await db.query(
    `INSERT INTO ppe_events (tenant_id,plant_id,area_id,camera_id,cam_label,
       event_type,is_violation,confidence,worker_bbox,frame_url,shift)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
    [tenantId, plantId, areaId, cameraId, camLabel,
     eventType, isViolation, confidence, JSON.stringify(workerBbox||{}), frameUrl, shift]
  );

  // If it's a violation, create full violation record + alert
  if (isViolation) {
    const fakeReq = { user: { tenantId, id: 'system' }, body: {
      plantId, areaId, cameraId, camLabel,
      violationType: eventType, severity: confidence > 95 ? 'high' : 'medium',
      confidence, frameUrl,
    }};
    const { sendAlert } = require('../services/alert.service');
    const { rows } = await db.query(
      `INSERT INTO violations (tenant_id,plant_id,area_id,camera_id,cam_label,
         violation_type,severity,confidence,frame_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId,plantId,areaId,cameraId,camLabel,
       eventType, confidence>95?'high':'medium', confidence, frameUrl]
    );
    const { getPub } = require('../config/redis');
    getPub().publish('violations', JSON.stringify({ action: 'new', violation: rows[0] }));
    await sendAlert({ violation: rows[0], tenantId });
  }

  // Update camera heartbeat
  await db.query(`UPDATE cameras SET last_heartbeat=NOW(), last_frame_at=NOW(), status='online'
                  WHERE id=$1`, [cameraId]);

  res.json({ success: true });
}));

wbRouter.post('/camera-health', asyncHandler(async (req, res) => {
  if (req.headers['x-api-key'] !== process.env.AI_API_KEY)
    throw new AppError('Unauthorised', 401);
  const db = getDB();
  const { cameraId, status, latencyMs, fps, errorMsg } = req.body;
  await db.query(
    `INSERT INTO camera_health_logs (camera_id,status,latency_ms,fps,error_msg) VALUES ($1,$2,$3,$4,$5)`,
    [cameraId, status, latencyMs, fps, errorMsg]);
  await db.query(`UPDATE cameras SET status=$1, last_heartbeat=NOW() WHERE id=$2`, [status, cameraId]);
  const { getPub } = require('../config/redis');
  getPub().publish('camera_health', JSON.stringify({ cameraId, status, latencyMs, fps }));
  res.json({ success: true });
}));

module.exports.webhookRoutes = wbRouter;
