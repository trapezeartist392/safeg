/**
 * Area Controller — /api/v1/areas
 * Manages monitoring zones inside a plant
 */
const { getDB }    = require('../config/database');
const { cache }    = require('../config/redis');
const { auditLog } = require('../services/audit.service');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ── LIST
exports.list = asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, riskLevel, isActive = true } = req.query;
  const where = ['a.tenant_id = $1']; const params = [req.user.tenantId]; let p = 2;
  if (plantId)   { where.push(`a.plant_id = $${p++}`);    params.push(plantId); }
  if (riskLevel) { where.push(`a.risk_level = $${p++}`);  params.push(riskLevel); }
  where.push(`a.is_active = $${p++}`); params.push(isActive !== 'false');

  const { rows } = await db.query(
    `SELECT a.*, p.plant_name,
       COUNT(DISTINCT c.id) AS camera_count,
       COUNT(DISTINCT v.id) FILTER (WHERE v.status='open') AS open_violations
     FROM areas a
     LEFT JOIN plants   p ON p.id = a.plant_id
     LEFT JOIN cameras  c ON c.area_id = a.id AND c.is_active
     LEFT JOIN violations v ON v.area_id = a.id
     WHERE ${where.join(' AND ')}
     GROUP BY a.id, p.plant_name
     ORDER BY p.plant_name, a.area_name`, params);

  res.json({ success: true, data: rows });
});

// ── CREATE
exports.create = asyncHandler(async (req, res) => {
  const db = getDB();
  const {
    plantId, areaName, areaCode, zoneType, riskLevel = 'medium',
    workerCount, areaSqft, hasHazardousMat = false, ppeRequired = [],
    alertSensitivity = 'medium', dangerZoneEnabled = false, notes,
  } = req.body;

  // Auto-generate area_code if not provided
  const cnt = await db.query('SELECT COUNT(*) FROM areas WHERE plant_id=$1', [plantId]);
  const seq = String(parseInt(cnt.rows[0].count) + 1).padStart(2, '0');
  const code = areaCode || `ZONE-${seq}`;

  const { rows } = await db.query(
    `INSERT INTO areas
       (tenant_id, plant_id, area_name, area_code, zone_type, risk_level,
        worker_count, area_sqft, has_hazardous_mat, ppe_required,
        alert_sensitivity, danger_zone_enabled, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [req.user.tenantId, plantId, areaName, code, zoneType, riskLevel,
     workerCount, areaSqft, hasHazardousMat, ppeRequired,
     alertSensitivity, dangerZoneEnabled, notes]
  );

  await cache.del(`areas:plant:${plantId}`);
  await auditLog({
    tenantId: req.user.tenantId, userId: req.user.id,
    action: 'CREATE_AREA', entityType: 'area', entityId: rows[0].id,
    newData: { areaName, plantId, riskLevel }
  });

  res.status(201).json({ success: true, data: rows[0] });
});

// ── GET ONE
exports.getOne = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT a.*, p.plant_name, p.city, p.hse_name,
       COUNT(DISTINCT c.id) AS camera_count
     FROM areas a
     LEFT JOIN plants p ON p.id = a.plant_id
     LEFT JOIN cameras c ON c.area_id = a.id AND c.is_active
     WHERE a.id=$1 AND a.tenant_id=$2
     GROUP BY a.id, p.plant_name, p.city, p.hse_name`,
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Area not found', 404);
  res.json({ success: true, data: rows[0] });
});

// ── UPDATE
exports.update = asyncHandler(async (req, res) => {
  const db = getDB();
  const allowed = [
    'area_name','zone_type','risk_level','worker_count','area_sqft',
    'has_hazardous_mat','alert_sensitivity','danger_zone_enabled','notes','floor_map_url'
  ];
  const sets = []; const vals = []; let p = 1;

  for (const [k, v] of Object.entries(req.body)) {
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowed.includes(col)) { sets.push(`${col}=$${p++}`); vals.push(v); }
  }
  // ppe_required is array — handle separately
  if (req.body.ppeRequired !== undefined) {
    sets.push(`ppe_required=$${p++}`);
    vals.push(req.body.ppeRequired);
  }
  if (!sets.length) throw new AppError('No valid fields to update', 400);

  vals.push(req.params.id, req.user.tenantId);
  const { rows } = await db.query(
    `UPDATE areas SET ${sets.join(',')}
     WHERE id=$${p++} AND tenant_id=$${p++} RETURNING *`, vals
  );
  if (!rows.length) throw new AppError('Area not found', 404);

  await cache.del(`areas:plant:${rows[0].plant_id}`);
  res.json({ success: true, data: rows[0] });
});

// ── REMOVE (soft delete)
exports.remove = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    'UPDATE areas SET is_active=FALSE WHERE id=$1 AND tenant_id=$2 RETURNING plant_id',
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Area not found', 404);
  await cache.del(`areas:plant:${rows[0].plant_id}`);
  res.json({ success: true, message: 'Area deactivated' });
});

// ── LIST CAMERAS for this area
exports.listCameras = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT c.*, a.area_name, a.zone_type
     FROM cameras c LEFT JOIN areas a ON a.id = c.area_id
     WHERE c.area_id=$1 AND c.tenant_id=$2 AND c.is_active
     ORDER BY c.cam_label`,
    [req.params.id, req.user.tenantId]
  );
  res.json({ success: true, data: rows });
});

// ── LIST VIOLATIONS for this area
exports.listViolations = asyncHandler(async (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20, status } = req.query;
  const offset = (page - 1) * limit;
  const where = ['v.area_id=$1', 'v.tenant_id=$2']; const params = [req.params.id, req.user.tenantId]; let p = 3;
  if (status) { where.push(`v.status=$${p++}`); params.push(status); }
  params.push(parseInt(limit), offset);
  const { rows } = await db.query(
    `SELECT * FROM v_violation_detail
     WHERE ${where.join(' AND ')}
     ORDER BY occurred_at DESC LIMIT $${p++} OFFSET $${p++}`, params
  );
  res.json({ success: true, data: rows });
});

// ── PPE COMPLIANCE stats for this area
exports.ppeStats = asyncHandler(async (req, res) => {
  const db = getDB();
  const { hours = 24 } = req.query;
  const { rows } = await db.query(
    `SELECT
       event_type,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_violation) AS violations,
       ROUND(AVG(confidence),1) AS avg_confidence,
       MAX(detected_at) AS last_detected
     FROM ppe_events
     WHERE area_id=$1 AND tenant_id=$2
       AND detected_at >= NOW() - ($3||' hours')::INTERVAL
     GROUP BY event_type
     ORDER BY violations DESC`,
    [req.params.id, req.user.tenantId, parseInt(hours)]
  );
  res.json({ success: true, data: rows });
});
