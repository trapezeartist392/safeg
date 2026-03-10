// ══════════════════════════════════════════════════
// PLANT CONTROLLER
// ══════════════════════════════════════════════════
const { getDB }    = require('../config/database');
const { cache }    = require('../config/redis');
const { auditLog } = require('../services/audit.service');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const db = getDB();
  const { customerId, state, isActive = true } = req.query;
  const where = ['p.tenant_id = $1']; const params = [req.user.tenantId]; let p = 2;
  if (customerId) { where.push(`p.customer_id = $${p++}`); params.push(customerId); }
  if (state)      { where.push(`p.state = $${p++}`); params.push(state); }
  where.push(`p.is_active = $${p++}`); params.push(isActive !== 'false');

  const { rows } = await db.query(
    `SELECT p.*, c.company_name,
       COUNT(DISTINCT a.id) AS area_count,
       COUNT(DISTINCT cam.id) AS camera_count,
       COUNT(DISTINCT cam.id) FILTER (WHERE cam.status='online') AS cameras_online
     FROM plants p
     LEFT JOIN customers c  ON c.id = p.customer_id
     LEFT JOIN areas a      ON a.plant_id = p.id
     LEFT JOIN cameras cam  ON cam.plant_id = p.id AND cam.is_active
     WHERE ${where.join(' AND ')}
     GROUP BY p.id, c.company_name
     ORDER BY p.plant_name`, params);
  res.json({ success: true, data: rows });
});

exports.create = asyncHandler(async (req, res) => {
  const db = getDB();
  const {
    customerId, plantName, factoryLicenceNo, factoryType, hazardCategory = 'medium',
    totalWorkers, address, pinCode, city, state, gpsLat, gpsLng,
    licenceExpiry, inspectorOffice, dgfasliRegion, shiftPattern = 'double',
    occupierName, managerName, hseName, hseEmail, hseMobile,
  } = req.body;

  // Auto-generate plant_code
  const cnt = await db.query('SELECT COUNT(*) FROM plants WHERE customer_id=$1', [customerId]);
  const seq = String(parseInt(cnt.rows[0].count) + 1).padStart(3, '0');
  const plantCode = `PLT-${city?.slice(0,3).toUpperCase() || 'XXX'}-${seq}`;

  const { rows } = await db.query(
    `INSERT INTO plants
       (tenant_id,customer_id,plant_name,plant_code,factory_licence_no,factory_type,
        hazard_category,total_workers,address,pin_code,city,state,gps_lat,gps_lng,
        licence_expiry,inspector_office,dgfasli_region,shift_pattern,
        occupier_name,manager_name,hse_name,hse_email,hse_mobile)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
     RETURNING *`,
    [req.user.tenantId, customerId, plantName, plantCode, factoryLicenceNo, factoryType,
     hazardCategory, totalWorkers, address, pinCode, city, state, gpsLat, gpsLng,
     licenceExpiry, inspectorOffice, dgfasliRegion, shiftPattern,
     occupierName, managerName, hseName, hseEmail, hseMobile]
  );
  await auditLog({ tenantId: req.user.tenantId, userId: req.user.id, action: 'CREATE_PLANT', entityType: 'plant', entityId: rows[0].id });
  res.status(201).json({ success: true, data: rows[0] });
});

exports.getOne = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT p.*, c.company_name, c.contact_email
     FROM plants p LEFT JOIN customers c ON c.id=p.customer_id
     WHERE p.id=$1 AND p.tenant_id=$2`, [req.params.id, req.user.tenantId]);
  if (!rows.length) throw new AppError('Plant not found', 404);
  res.json({ success: true, data: rows[0] });
});

exports.update = asyncHandler(async (req, res) => {
  const db = getDB();
  const allowed = ['plant_name','factory_licence_no','factory_type','hazard_category','total_workers',
    'address','pin_code','city','state','gps_lat','gps_lng','licence_expiry','inspector_office',
    'dgfasli_region','shift_pattern','occupier_name','manager_name','hse_name','hse_email','hse_mobile','is_active'];
  const sets=[]; const vals=[]; let p=1;
  for(const [k,v] of Object.entries(req.body)){
    const col=k.replace(/([A-Z])/g,'_$1').toLowerCase();
    if(allowed.includes(col)){sets.push(`${col}=$${p++}`);vals.push(v);}
  }
  if(!sets.length) throw new AppError('No valid fields',400);
  vals.push(req.params.id, req.user.tenantId);
  const {rows} = await db.query(
    `UPDATE plants SET ${sets.join(',')} WHERE id=$${p++} AND tenant_id=$${p++} RETURNING *`, vals);
  if(!rows.length) throw new AppError('Plant not found',404);
  res.json({ success: true, data: rows[0] });
});

exports.remove = asyncHandler(async (req, res) => {
  const db = getDB();
  await db.query('UPDATE plants SET is_active=FALSE WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user.tenantId]);
  res.json({ success: true, message: 'Plant deactivated' });
});

exports.dashboard = asyncHandler(async (req, res) => {
  const db = getDB();
  const cacheKey = `dashboard:${req.params.id}`;
  const data = await cache.getOrSet(cacheKey, async () => {
    const { rows } = await db.query('SELECT * FROM v_dashboard_summary WHERE plant_id=$1', [req.params.id]);
    return rows[0];
  }, 30);
  res.json({ success: true, data });
});

exports.listAreas = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT a.*, COUNT(c.id) AS camera_count FROM areas a
     LEFT JOIN cameras c ON c.area_id=a.id
     WHERE a.plant_id=$1 AND a.tenant_id=$2 AND a.is_active
     GROUP BY a.id ORDER BY a.area_name`,
    [req.params.id, req.user.tenantId]);
  res.json({ success: true, data: rows });
});

exports.listCameras = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT c.*, a.area_name FROM cameras c LEFT JOIN areas a ON a.id=c.area_id
     WHERE c.plant_id=$1 AND c.tenant_id=$2 AND c.is_active ORDER BY c.cam_label`,
    [req.params.id, req.user.tenantId]);
  res.json({ success: true, data: rows });
});

// ══════════════════════════════════════════════════
// AREA CONTROLLER  (appended to same file for brevity)
// ══════════════════════════════════════════════════
const areaAsync = require('../utils/asyncHandler');
const areaErr   = require('../utils/AppError');

const areCtrl = {
  list: areaAsync(async (req, res) => {
    const db = getDB();
    const { plantId } = req.query;
    const where = ['a.tenant_id=$1']; const params=[req.user.tenantId]; let p=2;
    if(plantId){where.push(`a.plant_id=$${p++}`);params.push(plantId);}
    const {rows} = await db.query(
      `SELECT a.*, p.plant_name, COUNT(c.id) AS camera_count
       FROM areas a LEFT JOIN plants p ON p.id=a.plant_id
       LEFT JOIN cameras c ON c.area_id=a.id
       WHERE ${where.join(' AND ')} AND a.is_active
       GROUP BY a.id, p.plant_name ORDER BY p.plant_name, a.area_name`, params);
    res.json({success:true,data:rows});
  }),

  create: areaAsync(async (req,res)=>{
    const db=getDB();
    const {plantId,areaName,areaCode,zoneType,riskLevel='medium',workerCount,areaSqft,
           hasHazardousMat=false,ppeRequired=[],alertSensitivity='medium',dangerZoneEnabled=false,notes}=req.body;
    const {rows}=await db.query(
      `INSERT INTO areas (tenant_id,plant_id,area_name,area_code,zone_type,risk_level,worker_count,area_sqft,
         has_hazardous_mat,ppe_required,alert_sensitivity,danger_zone_enabled,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.tenantId,plantId,areaName,areaCode,zoneType,riskLevel,workerCount,areaSqft,
       hasHazardousMat,ppeRequired,alertSensitivity,dangerZoneEnabled,notes]);
    res.status(201).json({success:true,data:rows[0]});
  }),

  getOne: areaAsync(async(req,res)=>{
    const db=getDB();
    const{rows}=await db.query(
      `SELECT a.*,p.plant_name FROM areas a LEFT JOIN plants p ON p.id=a.plant_id
       WHERE a.id=$1 AND a.tenant_id=$2`,[req.params.id,req.user.tenantId]);
    if(!rows.length) throw new areaErr('Area not found',404);
    res.json({success:true,data:rows[0]});
  }),

  update: areaAsync(async(req,res)=>{
    const db=getDB();
    const allowed=['area_name','zone_type','risk_level','worker_count','area_sqft',
      'has_hazardous_mat','alert_sensitivity','danger_zone_enabled','notes'];
    const sets=[]; const vals=[]; let p=1;
    for(const [k,v] of Object.entries(req.body)){
      const col=k.replace(/([A-Z])/g,'_$1').toLowerCase();
      if(allowed.includes(col)){sets.push(`${col}=$${p++}`);vals.push(v);}
    }
    if(req.body.ppeRequired!==undefined){sets.push(`ppe_required=$${p++}`);vals.push(req.body.ppeRequired);}
    vals.push(req.params.id,req.user.tenantId);
    const{rows}=await db.query(
      `UPDATE areas SET ${sets.join(',')} WHERE id=$${p++} AND tenant_id=$${p++} RETURNING *`,vals);
    if(!rows.length) throw new areaErr('Area not found',404);
    res.json({success:true,data:rows[0]});
  }),

  remove: areaAsync(async(req,res)=>{
    const db=getDB();
    await db.query('UPDATE areas SET is_active=FALSE WHERE id=$1 AND tenant_id=$2',[req.params.id,req.user.tenantId]);
    res.json({success:true,message:'Area deactivated'});
  }),

  listCameras: areaAsync(async(req,res)=>{
    const db=getDB();
    const{rows}=await db.query(
      'SELECT * FROM cameras WHERE area_id=$1 AND tenant_id=$2 AND is_active ORDER BY cam_label',
      [req.params.id,req.user.tenantId]);
    res.json({success:true,data:rows});
  }),

  listViolations: areaAsync(async(req,res)=>{
    const db=getDB();
    const{rows}=await db.query(
      `SELECT * FROM v_violation_detail WHERE area_id=$1 AND tenant_id=$2 ORDER BY occurred_at DESC LIMIT 50`,
      [req.params.id,req.user.tenantId]);
    res.json({success:true,data:rows});
  }),
};

module.exports = { ...exports, areCtrl };
