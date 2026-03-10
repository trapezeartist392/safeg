const { getDB, withTransaction } = require('../config/database');
const { cache }      = require('../config/redis');
const { auditLog }   = require('../services/audit.service');
const AppError       = require('../utils/AppError');
const asyncHandler   = require('../utils/asyncHandler');

// ── LIST
exports.list = asyncHandler(async (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20, search, state, plan, is_active } = req.query;
  const offset = (page - 1) * limit;

  const where = ['1=1'];
  const params = [];
  let p = 1;

  // Tenant isolation — non-superadmins see only their own customer
  if (req.user.role !== 'superadmin') {
    where.push(`c.tenant_id = $${p++}`); params.push(req.user.tenantId);
  }
  if (search)    { where.push(`c.company_name ILIKE $${p++}`); params.push(`%${search}%`); }
  if (state)     { where.push(`c.state = $${p++}`);            params.push(state); }
  if (plan)      { where.push(`c.plan = $${p++}`);             params.push(plan); }
  if (is_active !== undefined) { where.push(`c.is_active = $${p++}`); params.push(is_active === 'true'); }

  const sql = `
    SELECT c.*,
      COUNT(DISTINCT pl.id) AS plant_count,
      COUNT(DISTINCT cam.id) AS camera_count
    FROM customers c
    LEFT JOIN plants  pl  ON pl.customer_id = c.id AND pl.is_active
    LEFT JOIN cameras cam ON cam.plant_id = pl.id  AND cam.is_active
    WHERE ${where.join(' AND ')}
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT $${p++} OFFSET $${p++}
  `;
  params.push(parseInt(limit), offset);

  const countSql = `SELECT COUNT(*) FROM customers c WHERE ${where.join(' AND ')}`;
  const [rows, count] = await Promise.all([
    db.query(sql, params),
    db.query(countSql, params.slice(0, -2)),
  ]);

  res.json({
    success: true,
    data: rows.rows,
    pagination: { page: +page, limit: +limit, total: +count.rows[0].count },
  });
});

// ── CREATE
exports.create = asyncHandler(async (req, res) => {
  const db = getDB();
  const {
    companyName, cin, industry, employeeCount, annualTurnover,
    address, pinCode, city, state, gstin,
    contactName, contactEmail, contactMobile, contactDesig, contactDept, altPhone,
    plan = 'growth',
  } = req.body;

  const result = await withTransaction(async (client) => {
    // Upsert tenant if not exists for this session
    const tenantId = req.user.tenantId;

    const { rows } = await client.query(
      `INSERT INTO customers
         (tenant_id, company_name, cin, industry, employee_count, annual_turnover,
          address, pin_code, city, state, gstin,
          contact_name, contact_email, contact_mobile, contact_desig, contact_dept, alt_phone, plan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [tenantId, companyName, cin, industry, employeeCount, annualTurnover,
       address, pinCode, city, state, gstin,
       contactName, contactEmail, contactMobile, contactDesig, contactDept, altPhone, plan]
    );
    return rows[0];
  });

  await cache.del(`customers:${req.user.tenantId}`);
  await auditLog({ tenantId: req.user.tenantId, userId: req.user.id, action: 'CREATE_CUSTOMER', entityType: 'customer', entityId: result.id, newData: result });

  res.status(201).json({ success: true, data: result });
});

// ── GET ONE
exports.getOne = asyncHandler(async (req, res) => {
  const db = getDB();
  const { id } = req.params;

  const cacheKey = `customer:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: JSON.parse(cached) });

  const { rows } = await db.query(
    `SELECT c.*,
       json_agg(DISTINCT jsonb_build_object('id',p.id,'plant_name',p.plant_name,'city',p.city,'is_active',p.is_active))
         FILTER (WHERE p.id IS NOT NULL) AS plants
     FROM customers c
     LEFT JOIN plants p ON p.customer_id = c.id
     WHERE c.id = $1 AND (c.tenant_id = $2 OR $3 = 'superadmin')
     GROUP BY c.id`,
    [id, req.user.tenantId, req.user.role]
  );

  if (!rows.length) throw new AppError('Customer not found', 404);
  await cache.set(cacheKey, rows[0], 120);
  res.json({ success: true, data: rows[0] });
});

// ── UPDATE
exports.update = asyncHandler(async (req, res) => {
  const db = getDB();
  const { id } = req.params;

  // Build dynamic SET
  const allowed = ['company_name','cin','industry','employee_count','annual_turnover',
    'address','pin_code','city','state','gstin','contact_name','contact_email',
    'contact_mobile','contact_desig','contact_dept','alt_phone','plan','is_active','logo_url','notes'];

  const sets = []; const vals = []; let p = 1;
  for (const [k, v] of Object.entries(req.body)) {
    const col = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowed.includes(col)) { sets.push(`${col} = $${p++}`); vals.push(v); }
  }
  if (!sets.length) throw new AppError('No valid fields to update', 400);

  vals.push(id, req.user.tenantId);
  const { rows } = await db.query(
    `UPDATE customers SET ${sets.join(', ')} WHERE id = $${p++} AND tenant_id = $${p++} RETURNING *`,
    vals
  );
  if (!rows.length) throw new AppError('Customer not found or access denied', 404);

  await cache.del(`customer:${id}`);
  await auditLog({ tenantId: req.user.tenantId, userId: req.user.id, action: 'UPDATE_CUSTOMER', entityType: 'customer', entityId: id, newData: rows[0] });

  res.json({ success: true, data: rows[0] });
});

// ── DELETE
exports.remove = asyncHandler(async (req, res) => {
  const db = getDB();
  const { id } = req.params;
  await db.query('UPDATE customers SET is_active = FALSE WHERE id = $1', [id]);
  await cache.del(`customer:${id}`);
  res.json({ success: true, message: 'Customer deactivated' });
});

// ── STATS
exports.stats = asyncHandler(async (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { rows } = await db.query(
    `SELECT
       COUNT(DISTINCT p.id)   AS total_plants,
       COUNT(DISTINCT a.id)   AS total_areas,
       COUNT(DISTINCT c.id)   AS total_cameras,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'online') AS cameras_online,
       COUNT(DISTINCT v.id)   AS total_violations,
       COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'open') AS open_violations,
       COUNT(DISTINCT f.id)   AS total_form18
     FROM customers cust
     LEFT JOIN plants p    ON p.customer_id = cust.id
     LEFT JOIN areas a     ON a.plant_id = p.id
     LEFT JOIN cameras c   ON c.plant_id = p.id
     LEFT JOIN violations v ON v.plant_id = p.id
     LEFT JOIN form18_reports f ON f.plant_id = p.id
     WHERE cust.id = $1`,
    [id]
  );
  res.json({ success: true, data: rows[0] });
});
