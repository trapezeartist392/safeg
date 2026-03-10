const axios        = require('axios');
const { getDB }    = require('../config/database');
const { cache, getPub } = require('../config/redis');
const { auditLog } = require('../services/audit.service');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const logger       = require('../utils/logger');

// ── LIST cameras (filtered by plant/area/tenant)
exports.list = asyncHandler(async (req, res) => {
  const db = getDB();
  const { plantId, areaId, status } = req.query;
  const where = ['c.tenant_id = $1']; const params = [req.user.tenantId]; let p = 2;
  if (plantId) { where.push(`c.plant_id = $${p++}`); params.push(plantId); }
  if (areaId)  { where.push(`c.area_id  = $${p++}`); params.push(areaId); }
  if (status)  { where.push(`c.status   = $${p++}`); params.push(status); }

  const { rows } = await db.query(
    `SELECT c.*, a.area_name, a.zone_type, p.plant_name
     FROM cameras c
     LEFT JOIN areas  a ON a.id = c.area_id
     LEFT JOIN plants p ON p.id = c.plant_id
     WHERE ${where.join(' AND ')} AND c.is_active
     ORDER BY p.plant_name, a.area_name, c.cam_label`,
    params
  );
  res.json({ success: true, data: rows });
});

// ── CREATE
exports.create = asyncHandler(async (req, res) => {
  const db = getDB();
  const {
    plantId, areaId, camLabel, locationDesc, model, resolution,
    ipAddress, port = 554, streamProtocol = 'rtsp', rtspUrl,
    username, password, mountHeight, viewAngleDeg, coverageDesc,
    detectHelmet = true, detectVest = true, detectBoots = false,
    detectEye = false, detectGloves = false, detectEar = false,
    detectDangerZone = false, detectMotion = true,
    alertSensitivity = 'medium',
  } = req.body;

  // Build RTSP URL if not provided
  const streamUrl = rtspUrl || (ipAddress ? `rtsp://${username||'admin'}:${password||''}@${ipAddress}:${port}/stream1` : null);

  // Auto-generate cam_code
  const countRes = await db.query('SELECT COUNT(*) FROM cameras WHERE plant_id=$1', [plantId]);
  const seq      = String(parseInt(countRes.rows[0].count) + 1).padStart(3, '0');
  const camCode  = `CAM-PLT-${plantId.slice(-4).toUpperCase()}-${seq}`;

  const { rows } = await db.query(
    `INSERT INTO cameras
       (tenant_id, plant_id, area_id, cam_label, cam_code, location_desc, model, resolution,
        ip_address, port, stream_protocol, rtsp_url, username, password_enc,
        mount_height_m, view_angle_deg, coverage_desc,
        detect_helmet, detect_vest, detect_boots, detect_eye, detect_gloves, detect_ear,
        detect_danger_zone, detect_motion, alert_sensitivity)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     RETURNING *`,
    [req.user.tenantId, plantId, areaId, camLabel, camCode, locationDesc, model, resolution,
     ipAddress, port, streamProtocol, streamUrl, username, password, // TODO: encrypt password
     mountHeight, viewAngleDeg, coverageDesc,
     detectHelmet, detectVest, detectBoots, detectEye, detectGloves, detectEar,
     detectDangerZone, detectMotion, alertSensitivity]
  );

  const camera = rows[0];
  await cache.del(`cameras:plant:${plantId}`);

  // Notify AI engine to register this camera
  await notifyAiEngine('register', camera);

  await auditLog({ tenantId: req.user.tenantId, userId: req.user.id, action: 'CREATE_CAMERA', entityType: 'camera', entityId: camera.id, newData: { camLabel, ipAddress } });

  res.status(201).json({ success: true, data: camera });
});

// ── GET ONE
exports.getOne = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT c.*, a.area_name, a.zone_type, a.ppe_required, p.plant_name
     FROM cameras c
     LEFT JOIN areas a  ON a.id = c.area_id
     LEFT JOIN plants p ON p.id = c.plant_id
     WHERE c.id=$1 AND c.tenant_id=$2`,
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Camera not found', 404);
  res.json({ success: true, data: rows[0] });
});

// ── UPDATE
exports.update = asyncHandler(async (req, res) => {
  const db = getDB();
  const allowed = ['location_desc','model','resolution','ip_address','port','stream_protocol',
    'rtsp_url','username','mount_height_m','view_angle_deg','coverage_desc','alert_sensitivity','area_id'];
  const sets = []; const vals = []; let p = 1;
  for (const [k, v] of Object.entries(req.body)) {
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowed.includes(col)) { sets.push(`${col}=$${p++}`); vals.push(v); }
  }
  if (!sets.length) throw new AppError('No valid fields', 400);
  vals.push(req.params.id, req.user.tenantId);
  const { rows } = await db.query(
    `UPDATE cameras SET ${sets.join(',')} WHERE id=$${p++} AND tenant_id=$${p++} RETURNING *`, vals);
  if (!rows.length) throw new AppError('Camera not found', 404);
  await notifyAiEngine('update', rows[0]);
  res.json({ success: true, data: rows[0] });
});

// ── REMOVE
exports.remove = asyncHandler(async (req, res) => {
  const db = getDB();
  await db.query(`UPDATE cameras SET is_active=FALSE, status='offline' WHERE id=$1 AND tenant_id=$2`,
    [req.params.id, req.user.tenantId]);
  await notifyAiEngine('deregister', { id: req.params.id });
  res.json({ success: true, message: 'Camera deactivated' });
});

// ── TEST CONNECTION
exports.testConnection = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query('SELECT * FROM cameras WHERE id=$1 AND tenant_id=$2',
    [req.params.id, req.user.tenantId]);
  if (!rows.length) throw new AppError('Camera not found', 404);

  const cam = rows[0];
  let result = { success: false, latencyMs: null, fps: null, error: null };

  try {
    const start = Date.now();
    const aiRes = await axios.post(`${process.env.AI_ENGINE_URL}/api/camera/test`,
      { rtspUrl: cam.rtsp_url, cameraId: cam.id },
      { headers: { 'X-Api-Key': process.env.AI_API_KEY }, timeout: 10000 }
    );
    result = { success: true, latencyMs: Date.now() - start, fps: aiRes.data.fps, resolution: aiRes.data.resolution };
    await db.query(`UPDATE cameras SET status='online', last_heartbeat=NOW() WHERE id=$1`, [cam.id]);
  } catch (err) {
    result.error = err.message;
    await db.query(`UPDATE cameras SET status='error' WHERE id=$1`, [cam.id]);
    logger.warn(`Camera test failed for ${cam.cam_label}: ${err.message}`);
  }

  res.json({ success: true, data: result });
});

// ── RESTART
exports.restart = asyncHandler(async (req, res) => {
  await notifyAiEngine('restart', { id: req.params.id });
  res.json({ success: true, message: 'Restart command sent to AI engine' });
});

// ── HEALTH
exports.health = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT cl.*, c.cam_label FROM camera_health_logs cl
     JOIN cameras c ON c.id = cl.camera_id
     WHERE cl.camera_id=$1 ORDER BY cl.logged_at DESC LIMIT 50`,
    [req.params.id]
  );
  res.json({ success: true, data: rows });
});

// ── LIVE FRAME (proxy to AI engine)
exports.liveFrame = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query('SELECT rtsp_url, cam_label FROM cameras WHERE id=$1 AND tenant_id=$2',
    [req.params.id, req.user.tenantId]);
  if (!rows.length) throw new AppError('Camera not found', 404);

  try {
    const aiRes = await axios.get(`${process.env.AI_ENGINE_URL}/api/camera/${req.params.id}/frame`,
      { headers: { 'X-Api-Key': process.env.AI_API_KEY }, responseType: 'arraybuffer', timeout: 5000 });
    res.set('Content-Type', 'image/jpeg');
    res.send(aiRes.data);
  } catch {
    throw new AppError('Could not fetch live frame', 503);
  }
});

// ── UPDATE AI CONFIG
exports.updateAiConfig = asyncHandler(async (req, res) => {
  const db = getDB();
  const { detectHelmet, detectVest, detectBoots, detectEye, detectGloves, detectEar,
          detectDangerZone, detectMotion, alertSensitivity } = req.body;

  const { rows } = await db.query(
    `UPDATE cameras SET
       detect_helmet=$1, detect_vest=$2, detect_boots=$3, detect_eye=$4,
       detect_gloves=$5, detect_ear=$6, detect_danger_zone=$7, detect_motion=$8,
       alert_sensitivity=$9
     WHERE id=$10 AND tenant_id=$11 RETURNING *`,
    [detectHelmet, detectVest, detectBoots, detectEye, detectGloves, detectEar,
     detectDangerZone, detectMotion, alertSensitivity, req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError('Camera not found', 404);
  await notifyAiEngine('update_config', rows[0]);
  res.json({ success: true, data: rows[0], message: 'AI config updated — applying to live stream' });
});

// ── Helper: notify AI engine via HTTP
async function notifyAiEngine(action, camera) {
  try {
    await axios.post(`${process.env.AI_ENGINE_URL}/api/camera/${action}`,
      { camera },
      { headers: { 'X-Api-Key': process.env.AI_API_KEY }, timeout: 5000 }
    );
  } catch (err) {
    logger.warn(`AI Engine notify failed (${action}): ${err.message}`);
  }
}
