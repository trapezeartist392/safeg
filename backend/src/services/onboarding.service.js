/**
 * Onboarding Service
 * ──────────────────
 * Called when the wizard hits "Activate SafeG AI".
 * Runs a single transaction that:
 *   1. Creates tenant + customer
 *   2. Creates admin user + sends welcome email
 *   3. Creates plant record
 *   4. Creates all area/zone records
 *   5. Creates all camera records
 *   6. Notifies AI Engine to register cameras
 *   7. Seeds default inspection checklist
 *   8. Emits WebSocket event to connected clients
 */

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const axios   = require('axios');
const { withTransaction, getDB } = require('../config/database');
const { cache, getPub } = require('../config/redis');
const { sendEmail }     = require('./alert.service');
const { auditLog }      = require('./audit.service');
const { broadcast }     = require('../websocket/wsServer');
const AppError  = require('../utils/AppError');
const logger    = require('../utils/logger');

// ── DEFAULT INSPECTION CHECKLIST (24 items from frontend)
const DEFAULT_CHECKLIST = [
  { category: 'Safety Equipment', item_text: 'All PPE stocks checked and replenished' },
  { category: 'Safety Equipment', item_text: 'First aid boxes fully stocked' },
  { category: 'Safety Equipment', item_text: 'Fire extinguishers — pressure, pin, seal OK' },
  { category: 'Safety Equipment', item_text: 'Emergency eyewash stations operational' },
  { category: 'Safety Equipment', item_text: 'Safety signage visible and undamaged' },
  { category: 'Safety Equipment', item_text: 'Emergency exit lights functional' },
  { category: 'Machinery & Electrical', item_text: 'Machine guards in place on all equipment' },
  { category: 'Machinery & Electrical', item_text: 'Lockout/Tagout procedures followed' },
  { category: 'Machinery & Electrical', item_text: 'Electrical panels — doors closed, no exposed wires' },
  { category: 'Machinery & Electrical', item_text: 'Conveyor belts — guards and emergency stops tested' },
  { category: 'Machinery & Electrical', item_text: 'Overhead cranes — daily pre-use check done' },
  { category: 'Machinery & Electrical', item_text: 'Pressure vessels — gauges and relief valves OK' },
  { category: 'Fire Safety', item_text: 'Fire alarm panel — no faults, all zones active' },
  { category: 'Fire Safety', item_text: 'Sprinkler system — no obstructions below heads' },
  { category: 'Fire Safety', item_text: 'Fire hose reels — accessible and unwound' },
  { category: 'Fire Safety', item_text: 'Flammable material storage — cabinets locked' },
  { category: 'Fire Safety', item_text: 'Hot work permits issued and controlled' },
  { category: 'Fire Safety', item_text: 'Emergency assembly point — clear and marked' },
  { category: 'Housekeeping', item_text: 'All walkways clear — no slip/trip hazards' },
  { category: 'Housekeeping', item_text: 'Waste bins not overflowing' },
  { category: 'Housekeeping', item_text: 'Spill kits in place at chemical storage' },
  { category: 'Housekeeping', item_text: 'Loading/unloading dock — pedestrian barriers in place' },
  { category: 'Housekeeping', item_text: 'Canteen — hygiene and pest control record updated' },
  { category: 'Housekeeping', item_text: 'Contractor areas — daily permit-to-work checked' },
];

/**
 * Main onboarding activation
 * @param {Object} payload - The full wizard payload from frontend
 * @param {string} payload.customer - Customer form data
 * @param {string} payload.plant    - Plant form data
 * @param {Array}  payload.areas    - Array of area objects
 * @param {Array}  payload.cameras  - Array of camera objects
 * @param {string} payload.password - Admin password (from registration)
 */
exports.activateOnboarding = async (payload) => {
  const { customer, plant, areas, cameras, password } = payload;

  const result = await withTransaction(async (client) => {

    // ═══════════════════════════════════════════════
    // STEP 1: TENANT
    // ═══════════════════════════════════════════════
    const slug = customer.companyName
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
      + '-' + Date.now().toString(36);

    const tenantRes = await client.query(
      `INSERT INTO tenants (slug, plan, max_cameras, max_plants)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        slug,
        customer.plan || 'growth',
        customer.plan === 'starter' ? 8 : customer.plan === 'enterprise' ? 9999 : 32,
        customer.plan === 'starter' ? 1 : customer.plan === 'enterprise' ? 99 : 5,
      ]
    );
    const tenantId = tenantRes.rows[0].id;

    // ═══════════════════════════════════════════════
    // STEP 2: CUSTOMER RECORD
    // ═══════════════════════════════════════════════
    const customerRes = await client.query(
      `INSERT INTO customers
         (tenant_id, company_name, cin, industry, employee_count, annual_turnover,
          address, pin_code, city, state, gstin,
          contact_name, contact_email, contact_mobile, contact_desig, contact_dept,
          alt_phone, plan, plan_start_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,CURRENT_DATE)
       RETURNING id`,
      [
        tenantId,
        customer.companyName, customer.cin, customer.industry,
        customer.empCount, customer.turnover,
        customer.address, customer.pin, customer.city, customer.state, customer.gstin,
        customer.contactName, customer.email, customer.mobile,
        customer.contactDesig, customer.contactDept, customer.altPhone,
        customer.plan || 'growth',
      ]
    );
    const customerId = customerRes.rows[0].id;

    // ═══════════════════════════════════════════════
    // STEP 3: ADMIN USER
    // ═══════════════════════════════════════════════
    const hash = await bcrypt.hash(password || 'SafeG@2024!', 12);
    const userRes = await client.query(
      `INSERT INTO users
         (tenant_id, email, password_hash, full_name, designation, department, mobile, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'customer_admin')
       RETURNING id, email, full_name, role`,
      [
        tenantId, customer.email, hash,
        customer.contactName, customer.contactDesig,
        customer.contactDept, customer.mobile,
      ]
    );
    const adminUser = userRes.rows[0];

    // ═══════════════════════════════════════════════
    // STEP 4: PLANT
    // ═══════════════════════════════════════════════
    let gpsLat = null, gpsLng = null;
    if (plant.gps) {
      const parts = plant.gps.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !parts.some(isNaN)) {
        [gpsLat, gpsLng] = parts;
      }
    }

    // plant_code: PLT-{CITY_3}-001
    const cityCode = (plant.plantCity || plant.city || 'PLT').slice(0, 3).toUpperCase();
    const plantCode = `PLT-${cityCode}-001`;

    const plantRes = await client.query(
      `INSERT INTO plants
         (tenant_id, customer_id, plant_name, plant_code, factory_licence_no,
          factory_type, hazard_category, total_workers,
          address, pin_code, city, state, gps_lat, gps_lng,
          licence_expiry, inspector_office, dgfasli_region, shift_pattern,
          occupier_name, manager_name, hse_name, hse_email, hse_mobile)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       RETURNING id, plant_code`,
      [
        tenantId, customerId, plant.plantName, plantCode, plant.licNo,
        plant.factoryType,
        mapHazard(plant.hazard),
        parseInt(plant.workers) || null,
        plant.plantAddress, plant.plantPin, plant.plantCity, plant.plantState,
        gpsLat, gpsLng,
        plant.licExpiry || null, plant.inspectorOffice, plant.dgfasli,
        mapShift(plant.shifts),
        plant.occupier, plant.manager,
        plant.hseName, plant.hseEmail, plant.hseMobile,
      ]
    );
    const plantId   = plantRes.rows[0].id;
    const plantCode2 = plantRes.rows[0].plant_code;

    // ═══════════════════════════════════════════════
    // STEP 5: HSE OFFICER USER (if different from admin)
    // ═══════════════════════════════════════════════
    if (plant.hseEmail && plant.hseEmail !== customer.email) {
      const hseHash = await bcrypt.hash('SafeG@HSE2024!', 12);
      await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, full_name, mobile, role, plant_ids)
         VALUES ($1,$2,$3,$4,$5,'hse_officer', ARRAY[$6::uuid])
         ON CONFLICT (email) DO NOTHING`,
        [tenantId, plant.hseEmail, hseHash, plant.hseName, plant.hseMobile, plantId]
      );
    }

    // ═══════════════════════════════════════════════
    // STEP 6: AREAS
    // ═══════════════════════════════════════════════
    const areaIdMap = {}; // frontend area.id → DB area.id
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      const code = `ZONE-${plantCode2}-${String(i + 1).padStart(2, '0')}`;
      const areaRes = await client.query(
        `INSERT INTO areas
           (tenant_id, plant_id, area_name, area_code, zone_type, risk_level,
            worker_count, area_sqft, has_hazardous_mat, ppe_required,
            alert_sensitivity, danger_zone_enabled, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          tenantId, plantId, a.name, code, a.type,
          mapRisk(a.riskLevel),
          parseInt(a.workerCount) || null,
          a.sqft || null,
          a.hasHazardousMat === true || a.hasHazardousMat === 'Yes',
          a.ppeRequired || [],
          (a.alertSensitivity || 'medium').toLowerCase(),
          a.dangerZone === true,
          a.notes || null,
        ]
      );
      areaIdMap[a.id] = areaRes.rows[0].id;
    }

    // ═══════════════════════════════════════════════
    // STEP 7: CAMERAS
    // ═══════════════════════════════════════════════
    const cameraRecords = [];
    for (let i = 0; i < cameras.length; i++) {
      const c = cameras[i];
      const dbAreaId = areaIdMap[c.areaId] || null;
      const camCode  = `CAM-${plantCode2}-${String(i + 1).padStart(3, '0')}`;

      const rtspUrl = c.rtspUrl ||
        (c.ipAddress
          ? `rtsp://${c.username || 'admin'}:${c.password || ''}@${c.ipAddress}:${c.port || 554}/stream1`
          : null);

      const camRes = await client.query(
        `INSERT INTO cameras
           (tenant_id, plant_id, area_id, cam_label, cam_code, location_desc,
            model, resolution, ip_address, port, stream_protocol, rtsp_url,
            username, password_enc, mount_height_m, view_angle_deg, coverage_desc,
            detect_helmet, detect_vest, detect_boots, detect_eye, detect_gloves,
            detect_ear, detect_danger_zone, detect_motion, alert_sensitivity,
            installation_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                 $18,$19,$20,$21,$22,$23,$24,$25,$26, CURRENT_DATE)
         RETURNING id, cam_label, cam_code, ip_address, rtsp_url`,
        [
          tenantId, plantId, dbAreaId,
          c.camId || `CAM-${String(i + 1).padStart(2, '0')}`,
          camCode, c.location,
          c.model || null, c.resolution || null,
          c.ipAddress || null,
          parseInt(c.port) || 554,
          (c.protocol || 'rtsp').toLowerCase(),
          rtspUrl,
          c.username || null,
          c.password || null,          // TODO: AES encrypt in production
          parseFloat(c.mountHeight) || null,
          parseInt(c.viewAngle) || null,
          c.coverageDesc || null,
          c.detectHelmet !== false,
          c.detectVest   !== false,
          c.detectBoots  === true,
          c.detectEye    === true,
          c.detectGloves === true,
          c.detectEar    === true,
          c.dangerZone   === true,
          c.motionDetect !== false,
          (c.alertSensitivity || 'medium').toLowerCase(),
        ]
      );
      cameraRecords.push(camRes.rows[0]);
    }

    // ═══════════════════════════════════════════════
    // STEP 8: SEED DEFAULT INSPECTION CHECKLIST
    // ═══════════════════════════════════════════════
    // Store as a template (no session yet)
    await client.query(
      `INSERT INTO inspection_sessions
         (tenant_id, plant_id, session_date, total_items, status)
       VALUES ($1, $2, CURRENT_DATE, $3, 'template')`,
      [tenantId, plantId, DEFAULT_CHECKLIST.length]
    );

    return { tenantId, customerId, plantId, adminUser, cameraRecords, plantCode: plantCode2 };
  });

  // ═══════════════════════════════════════════════
  // POST-TRANSACTION: notify AI engine, send email, cache, broadcast
  // ═══════════════════════════════════════════════

  // 1. Notify AI engine to register all cameras
  await registerCamerasWithAI(result.cameraRecords, result.tenantId, result.plantId);

  // 2. Send welcome email
  await sendWelcomeEmail(result.adminUser.email, result.adminUser.full_name, result.plantCode);

  // 3. Cache tenant info
  await cache.set(`tenant:${result.tenantId}`, {
    tenantId: result.tenantId, customerId: result.customerId, plantId: result.plantId,
  }, 3600);

  // 4. Broadcast activation event via WebSocket
  try {
    broadcast(result.tenantId, {
      type: 'onboarding_complete',
      data: {
        plantId:     result.plantId,
        cameraCount: result.cameraRecords.length,
        message:     'SafeG AI activated — cameras connecting…',
        timestamp:   new Date().toISOString(),
      },
    });
  } catch { /* WS may not be ready yet */ }

  // 5. Audit log
  await auditLog({
    tenantId: result.tenantId,
    userId:   result.adminUser.id,
    action:   'ONBOARDING_ACTIVATE',
    entityType: 'tenant',
    entityId:   result.tenantId,
    newData: {
      customerId:  result.customerId,
      plantId:     result.plantId,
      cameras:     result.cameraRecords.length,
    },
  });

  // 6. Generate JWT for immediate login
  const accessToken  = jwt.sign(
    { sub: result.adminUser.id, tid: result.tenantId, role: result.adminUser.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
  const refreshToken = jwt.sign(
    { sub: result.adminUser.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  // Save refresh token
  const db = getDB();
  await db.query('UPDATE users SET refresh_token=$1, last_login_at=NOW() WHERE id=$2',
    [refreshToken, result.adminUser.id]);

  return {
    ...result,
    accessToken,
    refreshToken,
    dashboardUrl: `https://app.syyaimsafeg.ai/${result.plantCode.toLowerCase()}`,
  };
};

// ── Notify AI engine about new cameras
async function registerCamerasWithAI(cameras, tenantId, plantId) {
  if (!process.env.AI_ENGINE_URL) {
    logger.warn('AI_ENGINE_URL not set — skipping camera registration');
    return;
  }
  for (const cam of cameras) {
    try {
      await axios.post(
        `${process.env.AI_ENGINE_URL}/api/camera/register`,
        { cameraId: cam.id, tenantId, plantId, rtspUrl: cam.rtsp_url, camLabel: cam.cam_label },
        { headers: { 'X-Api-Key': process.env.AI_API_KEY }, timeout: 5000 }
      );
      logger.info(`Camera registered with AI: ${cam.cam_label}`);
    } catch (err) {
      logger.warn(`AI registration failed for ${cam.cam_label}: ${err.message}`);
    }
  }
}

// ── Welcome email
async function sendWelcomeEmail(email, name, plantCode) {
  try {
    await sendEmail({
      to: email,
      subject: '🚀 SafeG AI — Your plant is now live!',
      html: `
        <div style="font-family:sans-serif;max-width:580px;border:2px solid #FF5B18;border-radius:10px;overflow:hidden">
          <div style="background:#FF5B18;color:#fff;padding:20px 24px">
            <div style="font-size:22px;font-weight:900;letter-spacing:2px">SAFEG AI ACTIVATED ✅</div>
          </div>
          <div style="padding:24px">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your SafeG AI system is now live. Your cameras are connecting and PPE monitoring will begin shortly.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="color:#666;padding:8px 0;border-bottom:1px solid #eee">Plant Code</td>
                  <td style="font-family:monospace;font-weight:bold">${plantCode}</td></tr>
              <tr><td style="color:#666;padding:8px 0;border-bottom:1px solid #eee">Dashboard</td>
                  <td><a href="https://app.syyaimsafeg.ai" style="color:#FF5B18">app.syyaimsafeg.ai</a></td></tr>
              <tr><td style="color:#666;padding:8px 0">Support</td>
                  <td><a href="mailto:support@syyaimsafeg.ai">support@syyaimsafeg.ai</a></td></tr>
            </table>
            <a href="https://app.syyaimsafeg.ai" style="display:inline-block;background:#FF5B18;color:#fff;
               padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
              Go to Dashboard →
            </a>
          </div>
        </div>`,
    });
  } catch (err) {
    logger.warn('Welcome email failed:', err.message);
  }
}

// ── ENUM mappers (frontend labels → DB enums)
function mapHazard(val) {
  if (!val) return 'medium';
  const v = val.toLowerCase();
  if (v.includes('highly') || v.includes('msihc')) return 'very_high';
  if (v.includes('high'))   return 'high';
  if (v.includes('low'))    return 'low';
  return 'medium';
}

function mapShift(val) {
  if (!val) return 'double';
  const v = val.toLowerCase();
  if (v.includes('continuous') || v.includes('24')) return 'continuous';
  if (v.includes('triple') || v.includes('3×'))      return 'triple';
  if (v.includes('single'))                           return 'single';
  return 'double';
}

function mapRisk(val) {
  if (!val) return 'medium';
  const v = val.toLowerCase();
  if (v.includes('very') || v.includes('hazardous')) return 'very_high';
  if (v.includes('high'))   return 'high';
  if (v.includes('low'))    return 'low';
  return 'medium';
}
