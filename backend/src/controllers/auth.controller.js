const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { getDB, withTransaction } = require('../config/database');
const { cache } = require('../config/redis');
const { auditLog }  = require('../services/audit.service');
const { sendEmail } = require('../services/email.service');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

const signAccess  = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' });

// ── REGISTER (called by onboarding wizard on activation)
exports.register = asyncHandler(async (req, res) => {
  const { companyName, email, password, fullName, plan = 'growth' } = req.body;
  const db = getDB();

  const exists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.rows.length) throw new AppError('Email already registered', 409);

  const result = await withTransaction(async (client) => {
    // 1. Create tenant
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '-' + Date.now().toString(36);
    const tenant = await client.query(
      `INSERT INTO tenants (slug, plan) VALUES ($1, $2) RETURNING id`,
      [slug, plan]
    );
    const tenantId = tenant.rows[0].id;

    // 2. Create customer record
    const customer = await client.query(
      `INSERT INTO customers (tenant_id, company_name, contact_email, contact_name, plan)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, companyName, email, fullName, plan]
    );

    // 3. Create admin user
    const hash = await bcrypt.hash(password, 12);
    const user = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'customer_admin') RETURNING id, email, full_name, role`,
      [tenantId, email, hash, fullName]
    );

    return { tenantId, customerId: customer.rows[0].id, user: user.rows[0] };
  });

  const accessToken  = signAccess({ sub: result.user.id, tid: result.tenantId, role: result.user.role });
  const refreshToken = signRefresh({ sub: result.user.id });

  // Save refresh token
  await db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, result.user.id]);

  await auditLog({ tenantId: result.tenantId, userId: result.user.id, action: 'REGISTER', entityType: 'user', entityId: result.user.id });

  res.status(201).json({
    success: true,
    message: 'Account created — SafeG AI activated',
    data: {
      user: { id: result.user.id, email: result.user.email, fullName: result.user.full_name, role: result.user.role },
      tenantId: result.tenantId,
      customerId: result.customerId,
      accessToken,
      refreshToken,
    }
  });
});

// ── LOGIN
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const db = getDB();

  const { rows } = await db.query(
    `SELECT u.*, t.plan, t.is_active AS tenant_active
     FROM users u JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = $1`,
    [email]
  );

  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    throw new AppError('Invalid email or password', 401);

  if (!user.is_active)       throw new AppError('Account suspended — contact support', 403);
  if (!user.tenant_active)   throw new AppError('Your organisation account is inactive', 403);

  const payload = { sub: user.id, tid: user.tenant_id, role: user.role };
  const accessToken  = signAccess(payload);
  const refreshToken = signRefresh({ sub: user.id });

  await db.query('UPDATE users SET refresh_token=$1, last_login_at=NOW() WHERE id=$2', [refreshToken, user.id]);

  // Cache user session
  await cache.set(`session:${user.id}`, { id: user.id, tenantId: user.tenant_id, role: user.role }, 86400);

  await auditLog({ tenantId: user.tenant_id, userId: user.id, action: 'LOGIN', entityType: 'session', entityId: user.id, req });

  res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, designation: user.designation },
      tenantId: user.tenant_id,
      plan: user.plan,
      accessToken,
      refreshToken,
    }
  });
});

// ── REFRESH TOKEN
exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token required', 400);

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const db = getDB();
  const { rows } = await db.query(
    'SELECT id, tenant_id, role, refresh_token FROM users WHERE id = $1 AND is_active = TRUE',
    [decoded.sub]
  );

  const user = rows[0];
  if (!user || user.refresh_token !== refreshToken)
    throw new AppError('Refresh token revoked', 401);

  const newAccess  = signAccess({ sub: user.id, tid: user.tenant_id, role: user.role });
  const newRefresh = signRefresh({ sub: user.id });

  await db.query('UPDATE users SET refresh_token=$1 WHERE id=$2', [newRefresh, user.id]);

  res.json({ success: true, data: { accessToken: newAccess, refreshToken: newRefresh } });
});

// ── LOGOUT
exports.logout = asyncHandler(async (req, res) => {
  const db = getDB();
  await db.query('UPDATE users SET refresh_token=NULL WHERE id=$1', [req.user.id]);
  await cache.del(`session:${req.user.id}`);
  res.json({ success: true, message: 'Logged out' });
});

// ── FORGOT PASSWORD
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const db = getDB();
  const { rows } = await db.query('SELECT id, full_name FROM users WHERE email=$1', [email]);
  const user = rows[0];

  if (user) {
    const token   = uuid();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.query('UPDATE users SET password_reset_token=$1, password_reset_expires=$2 WHERE id=$3',
      [token, expires, user.id]);

    await sendEmail({
      to: email,
      subject: 'SafeG AI — Password Reset',
      html: `<p>Hi ${user.full_name},</p>
             <p>Click <a href="${process.env.API_BASE_URL}/reset-password?token=${token}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    });
  }

  // Always return 200 (don't reveal if email exists)
  res.json({ success: true, message: 'If that email is registered, a reset link was sent' });
});

// ── RESET PASSWORD
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const db = getDB();

  const { rows } = await db.query(
    `SELECT id FROM users WHERE password_reset_token=$1 AND password_reset_expires > NOW()`,
    [token]
  );
  if (!rows.length) throw new AppError('Reset token invalid or expired', 400);

  const hash = await bcrypt.hash(password, 12);
  await db.query(
    `UPDATE users SET password_hash=$1, password_reset_token=NULL, password_reset_expires=NULL WHERE id=$2`,
    [hash, rows[0].id]
  );

  res.json({ success: true, message: 'Password updated — please login' });
});

// ── GET ME
exports.getMe = asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.full_name, u.designation, u.department, u.mobile, u.role, u.plant_ids, u.last_login_at,
            t.plan, t.slug AS tenant_slug,
            c.company_name, c.city, c.state
     FROM users u
     JOIN tenants t   ON t.id = u.tenant_id
     LEFT JOIN customers c ON c.tenant_id = u.tenant_id
     WHERE u.id = $1`,
    [req.user.id]
  );
  res.json({ success: true, data: rows[0] });
});
