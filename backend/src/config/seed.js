/**
 * SafeG AI — Database Seed
 * Run: node src/config/seed.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { connectDB, withTransaction } = require('./database');
const logger = require('../utils/logger');

async function seed() {
  await connectDB();
  logger.info('Seeding demo data...');

  await withTransaction(async (client) => {

    // 1. TENANT
    const tenantId = uuid();
    await client.query(
      `INSERT INTO tenants (id, slug, plan, max_cameras, max_plants)
       VALUES ($1, 'pune-auto-demo', 'growth', 32, 5)
       ON CONFLICT (slug) DO NOTHING`,
      [tenantId]
    );

    // Re-fetch tenantId in case it already existed
    const tRes = await client.query(`SELECT id FROM tenants WHERE slug = 'pune-auto-demo'`);
    const tid = tRes.rows[0].id;

    // 2. CUSTOMER
    const customerId = uuid();
    await client.query(
      `INSERT INTO customers (
         id, tenant_id, company_name, industry, cin, gstin,
         address_line1, city, state, pincode,
         primary_contact, contact_email, contact_phone, plan
       ) VALUES (
         $1, $2, 'Pune Auto Components Pvt Ltd',
         'Automobile & Auto Components',
         'U29100MH2018PTC000123', '27AABCP2018R1ZV',
         'Plot 47, MIDC Industrial Area, Pimpri-Chinchwad',
         'Pune', 'Maharashtra', '411018',
         'Suresh Nair', 'suresh@puneauto.com', '+919876543210', 'growth'
       ) ON CONFLICT DO NOTHING`,
      [customerId, tid]
    );
    const cRes = await client.query(`SELECT id FROM customers WHERE tenant_id = $1 LIMIT 1`, [tid]);
    const cid = cRes.rows[0].id;

    // 3. ADMIN USER  (password: Demo@SafeG2024!)
    const userId = uuid();
    const hash   = await bcrypt.hash('Demo@SafeG2024!', 12);
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role)
       VALUES ($1, $2, 'suresh@puneauto.com', $3, 'Suresh Nair', '+919876543210', 'customer_admin')
       ON CONFLICT (email) DO NOTHING`,
      [userId, tid, hash]
    );

    // HSE Officer user
    const hseId = uuid();
    const hseHash = await bcrypt.hash('HSE@SafeG2024!', 12);
    await client.query(
      `INSERT INTO users (id, tenant_id, email, password_hash, full_name, phone, role)
       VALUES ($1, $2, 'rajesh@puneauto.com', $3, 'Rajesh Patil', '+919876512345', 'hse_officer')
       ON CONFLICT (email) DO NOTHING`,
      [hseId, tid, hseHash]
    );

    // 4. PLANT
    const plantId = uuid();
    await client.query(
      `INSERT INTO plants (
         id, tenant_id, customer_id, plant_name, factory_licence,
         address_line1, city, state, pincode,
         latitude, longitude, total_workers, shift_type,
         shift1_start, shift1_end,
         hse_officer_name, hse_officer_phone, hse_officer_email
       ) VALUES (
         $1, $2, $3,
         'Pune Unit 1 — Main Plant',
         'MH/PUN/F/2019/00423',
         'Plot 47, MIDC Industrial Area, Pimpri-Chinchwad',
         'Pune', 'Maharashtra', '411018',
         18.6279, 73.7997, 350, 'double',
         '06:00', '14:00',
         'Rajesh Patil', '+919876512345', 'rajesh@puneauto.com'
       ) ON CONFLICT DO NOTHING`,
      [plantId, tid, cid]
    );
    const pRes = await client.query(`SELECT id FROM plants WHERE tenant_id = $1 LIMIT 1`, [tid]);
    const pid = pRes.rows[0].id;

    // 5. AREAS
    const areas = [
      { name: 'Welding Bay A',   type: 'Welding Zone',                  hazard: 'high',      danger: true,  ppe: ['Hard Hat','Safety Vest','Eye Protection','Gloves','Face Shield'] },
      { name: 'Assembly Line 1', type: 'Assembly Line',                  hazard: 'medium',    danger: false, ppe: ['Hard Hat','Safety Vest','Safety Boots'] },
      { name: 'Paint Shop',      type: 'Paint Shop',                     hazard: 'very_high', danger: true,  ppe: ['Hard Hat','Safety Vest','Respiratory Mask','Eye Protection','Gloves'] },
      { name: 'Forklift Zone',   type: 'Forklift / Material Handling',   hazard: 'high',      danger: true,  ppe: ['Hard Hat','Safety Vest','Safety Boots'] },
    ];

    const areaIds = [];
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      const aId = uuid();
      areaIds.push(aId);
      await client.query(
        `INSERT INTO areas (
           id, tenant_id, plant_id, area_name, zone_type,
           hazard_level, is_danger_zone, worker_capacity, ppe_required
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [aId, tid, pid, a.name, a.type,
         a.hazard, a.danger,
         Math.floor(Math.random() * 40 + 15),
         JSON.stringify(a.ppe)]
      );
    }

    // 6. CAMERAS
    const cams = [
      { label: 'CAM-01', areaIdx: 0, ip: '192.168.1.101', loc: 'Welding Bay A — North wall, 4m height' },
      { label: 'CAM-02', areaIdx: 1, ip: '192.168.1.102', loc: 'Assembly Line 1 — Overhead gantry, 5m' },
      { label: 'CAM-03', areaIdx: 2, ip: '192.168.1.103', loc: 'Paint Shop entry — Door mounted, 3m' },
      { label: 'CAM-04', areaIdx: 3, ip: '192.168.1.104', loc: 'Forklift Zone — Pillar mount, 6m height' },
    ];

    const camIds = [];
    for (let i = 0; i < cams.length; i++) {
      const c = cams[i];
      const camId = uuid();
      camIds.push(camId);
      await client.query(
        `INSERT INTO cameras (
           id, tenant_id, plant_id, area_id,
           cam_label, cam_code, location_desc,
           model, resolution, ip_address, port,
           stream_protocol, rtsp_url, username,
           detect_helmet, detect_vest, detect_boots, detect_eye,
           detect_danger_zone, detect_motion,
           alert_sensitivity, status
         ) VALUES (
           $1,$2,$3,$4,
           $5,$6,$7,
           'Hikvision DS-2CD2143G2-I','1080p Full HD',
           $8,554,'rtsp',$9,'admin',
           TRUE,TRUE,TRUE,TRUE,$10,TRUE,'high','online'
         ) ON CONFLICT DO NOTHING`,
        [camId, tid, pid, areaIds[c.areaIdx],
         c.label,
         `CAM-PLT-PUN-001-${String(i + 1).padStart(3, '0')}`,
         c.loc, c.ip,
         `rtsp://admin:@${c.ip}:554/stream1`,
         i === 3]
      );
    }

    // 7. SAMPLE VIOLATIONS
    const violTypes  = ['no_helmet', 'no_vest', 'danger_zone_breach', 'no_eye_protection', 'no_boots'];
    const severities = ['medium',    'high',    'high',               'medium',             'critical'];
    for (let i = 0; i < 5; i++) {
      await client.query(
        `INSERT INTO violations (
           tenant_id, plant_id, area_id, camera_id, violation_cam,
           violation_type, severity, confidence, status, occurred_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
           NOW() - ($10 || ' hours')::INTERVAL)`,
        [tid, pid,
         areaIds[i % areaIds.length],
         camIds[i % camIds.length],
         cams[i % cams.length].label,
         violTypes[i], severities[i],
         (85 + Math.random() * 14).toFixed(1),
         i < 3 ? 'open' : 'resolved',
         String(i * 2 + 1)]
      );
    }

    logger.info(`
✅  Seed complete!
    Tenant:     ${tid}
    Customer:   ${cid}
    Plant:      ${pid}
    Areas:      ${areas.length}
    Cameras:    ${cams.length}
    Violations: 5 (3 open, 2 resolved)

    Login: suresh@puneauto.com / Demo@SafeG2024!
    `);
  });

  process.exit(0);
}

seed().catch(err => { logger.error(err.message); process.exit(1); });
