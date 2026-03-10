const { getDB }    = require('../config/database');
const { cache, getPub } = require('../config/redis');
const { sendAlert }     = require('../services/alert.service');
const { auditLog }      = require('../services/audit.service');
const AppError          = require('../utils/AppError');
const asyncHandler      = require('../utils/asyncHandler');

// ── LIST with full filtering
exports.list = asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, areaId, cameraId, status, severity, from, to,
          page = 1, limit = 50, violationType } = req.query;
  const offset = (page - 1) * limit;

  const where = ['v.tenant_id = $1']; const params = [req.user.tenantId]; let p = 2;
  if (plantId)       { where.push(`v.plant_id = $${p++}`);       params.push(plantId); }
  if (areaId)        { where.push(`v.area_id = $${p++}`);        params.push(areaId); }
  if (cameraId)      { where.push(`v.camera_id = $${p++}`);      params.push(cameraId); }
  if (status)        { where.push(`v.status = $${p++}`);         params.push(status); }
  if (severity)      { where.push(`v.severity = $${p++}`);       params.push(severity); }
  if (violationType) { where.push(`v.violation_type ILIKE $${p++}`); params.push(`%${violationType}%`); }
  if (from)          { where.push(`v.occurred_at >= $${p++}`);   params.push(from); }
  if (to)            { where.push(`v.occurred_at <= $${p++}`);   params.push(to); }

  const sql = `
    SELECT v.*, p.plant_name, a.area_name, cam.cam_label, u.full_name AS assigned_to_name
    FROM violations v
    LEFT JOIN plants p  ON p.id = v.plant_id
    LEFT JOIN areas a   ON a.id = v.area_id
    LEFT JOIN cameras cam ON cam.id = v.camera_id
    LEFT JOIN users u   ON u.id = v.assigned_to
    WHERE ${where.join(' AND ')}
    ORDER BY v.occurred_at DESC
    LIMIT $${p++} OFFSET $${p++}
  `;
  params.push(parseInt(limit), offset);

  const { rows } = await db.query(sql, params);
  const { rows: cnt } = await db.query(
    `SELECT COUNT(*) FROM violations v WHERE ${where.join(' AND ')}`,
    params.slice(0, -2)
  );

  res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total: +cnt[0].count } });
});

// ── CREATE (also called internally by AI engine webhook)
exports.create = asyncHandler(async (req, res) => {
  const db = getDB();
  const {
    plantId, areaId, cameraId, camLabel,
    violationType, description, severity = 'medium',
    workerId, confidence, frameUrl, videoClipUrl, ppeEventId,
  } = req.body;

  const { rows } = await db.query(
    `INSERT INTO violations
       (tenant_id, plant_id, area_id, camera_id, cam_label,
        violation_type, description, severity, worker_id, confidence,
        frame_url, video_clip_url, ppe_event_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [req.user.tenantId, plantId, areaId, cameraId, camLabel,
     violationType, description, severity, workerId, confidence,
     frameUrl, videoClipUrl, ppeEventId]
  );

  const violation = rows[0];

  // Publish to WebSocket
  const pub = getPub();
  pub.publish('violations', JSON.stringify({ action: 'new', violation }));

  // Invalidate dashboard cache
  await cache.del(`dashboard:${plantId}`);

  // Trigger alerts
  await sendAlert({ violation, tenantId: req.user.tenantId });

  await auditLog({ tenantId: req.user.tenantId, userId: req.user.id,
    action: 'CREATE_VIOLATION', entityType: 'violation', entityId: violation.id });

  res.status(201).json({ success: true, data: violation });
});

// ── GET ONE
exports.getOne = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT * FROM v_violation_detail WHERE id=$1 AND tenant_id=$2`,
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Violation not found', 404);
  res.json({ success: true, data: rows[0] });
});

// ── ACKNOWLEDGE
exports.acknowledge = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `UPDATE violations SET status='acknowledged', acknowledged_at=NOW()
     WHERE id=$1 AND tenant_id=$2 AND status='open' RETURNING *`,
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Violation not found or already acknowledged', 404);
  const pub = getPub();
  pub.publish('violations', JSON.stringify({ action: 'acknowledged', id: req.params.id }));
  res.json({ success: true, data: rows[0] });
});

// ── RESOLVE
exports.resolve = asyncHandler(async (req, res) => {
  const db = getDB();
  const { correctiveAction } = req.body;
  const { rows } = await db.query(
    `UPDATE violations
     SET status='resolved', corrective_action=$1, resolved_at=NOW(), resolved_by=$2
     WHERE id=$3 AND tenant_id=$4 RETURNING *`,
    [correctiveAction, req.user.id, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Violation not found', 404);
  await cache.del(`dashboard:${rows[0].plant_id}`);
  const pub = getPub();
  pub.publish('violations', JSON.stringify({ action: 'resolved', id: req.params.id }));
  res.json({ success: true, data: rows[0] });
});

// ── ASSIGN
exports.assign = asyncHandler(async (req, res) => {
  const db = getDB();
  const { assignTo } = req.body;
  const { rows } = await db.query(
    `UPDATE violations SET assigned_to=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *`,
    [assignTo, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Violation not found', 404);
  res.json({ success: true, data: rows[0] });
});

// ── ESCALATE
exports.escalate = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `UPDATE violations SET status='escalated' WHERE id=$1 AND tenant_id=$2 RETURNING *`,
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Violation not found', 404);
  await sendAlert({ violation: rows[0], tenantId: req.user.tenantId, escalated: true });
  res.json({ success: true, data: rows[0] });
});

// ── STATS (for dashboard KPIs)
exports.stats = asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, period = '7d' } = req.query;
  const interval = period === '30d' ? '30 days' : period === '24h' ? '24 hours' : '7 days';

  const where = [`tenant_id = $1`]; const params = [req.user.tenantId]; let p = 2;
  if (plantId) { where.push(`plant_id = $${p++}`); params.push(plantId); }

  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open')                  AS open_count,
       COUNT(*) FILTER (WHERE status = 'resolved')              AS resolved_count,
       COUNT(*) FILTER (WHERE status = 'pending')               AS pending_count,
       COUNT(*) FILTER (WHERE occurred_at >= NOW() - INTERVAL '${interval}') AS period_count,
       COUNT(*) FILTER (WHERE severity = 'high' OR severity = 'critical') AS high_severity,
       AVG(EXTRACT(EPOCH FROM (resolved_at - occurred_at))/3600) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_hours,
       json_object_agg(violation_type, vtype_count) AS by_type
     FROM (
       SELECT *, COUNT(*) OVER (PARTITION BY violation_type) AS vtype_count
       FROM violations WHERE ${where.join(' AND ')}
     ) sub`,
    params
  );
  res.json({ success: true, data: rows[0] });
});

// ── GET FORM18 DATA (pre-populates Form 18 from this violation)
exports.getForm18Data = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT v.*, p.plant_name, p.factory_licence_no, p.occupier_name, p.manager_name,
            p.address AS plant_address, p.district, p.state, p.inspector_office,
            p.hse_name, p.hse_email, p.hse_mobile,
            a.area_name, a.zone_type,
            c.cam_label, c.location_desc,
            cust.company_name, cust.gstin, cust.industry
     FROM v_violation_detail v
     LEFT JOIN plants p    ON p.id = v.plant_id
     LEFT JOIN areas a     ON a.id = v.area_id
     LEFT JOIN cameras c   ON c.id = v.camera_id
     LEFT JOIN customers cust ON cust.tenant_id = v.tenant_id
     WHERE v.id=$1 AND v.tenant_id=$2`,
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Violation not found', 404);

  const v = rows[0];
  // Map to Form 18 structure
  const form18Pre = {
    // Part A
    factoryName:     v.company_name,
    factoryRegNo:    v.factory_licence_no,
    industryType:    v.industry,
    factoryAddress:  v.plant_address,
    district:        v.district,
    state:           v.state,
    occupierName:    v.occupier_name,
    managerName:     v.manager_name,
    // Part B
    accidentDate:    v.occurred_at ? v.occurred_at.toISOString().slice(0, 10) : null,
    accidentTime:    v.occurred_at ? v.occurred_at.toISOString().slice(11, 16) : null,
    department:      `${v.area_name} — ${v.zone_type || ''}`,
    // Part E
    aiCameraId:      v.cam_label,
    aiTimestamp:     v.occurred_at,
    aiConfidence:    v.confidence,
    videoClipUrl:    v.video_clip_url,
    frameUrl:        v.frame_url,
    // Part G
    inspectorOffice: v.inspector_office,
    hseName:         v.hse_name,
    hseEmail:        v.hse_email,
  };

  res.json({ success: true, data: { violation: v, form18Prefill: form18Pre } });
});
