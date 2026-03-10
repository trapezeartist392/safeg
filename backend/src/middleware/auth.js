const jwt    = require('jsonwebtoken');
const { cache } = require('../config/redis');
const { getDB } = require('../config/database');
const AppError  = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ── Verify JWT + attach req.user
exports.authenticate = asyncHandler(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw new AppError('Authentication required', 401);

  const token = auth.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    throw new AppError(e.name === 'TokenExpiredError' ? 'Token expired — please refresh' : 'Invalid token', 401);
  }

  // Try session cache first
  const cached = await cache.get(`session:${decoded.sub}`);
  if (cached) {
    req.user = JSON.parse(cached);
    return next();
  }

  // Fallback to DB
  const db = getDB();
  const { rows } = await db.query(
    'SELECT id, tenant_id AS "tenantId", role, is_active FROM users WHERE id=$1',
    [decoded.sub]
  );
  if (!rows.length || !rows[0].is_active) throw new AppError('User not found or inactive', 401);

  req.user = rows[0];
  await cache.set(`session:${decoded.sub}`, rows[0], 300);
  next();
});

// ── Role-based access control
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    throw new AppError(`Access denied — requires role: ${roles.join(' or ')}`, 403);
  next();
};

// ── Tenant isolation guard (ensures user can only touch their tenant's data)
exports.tenantGuard = (req, res, next) => {
  const tid = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  if (tid && tid !== req.user.tenantId && req.user.role !== 'superadmin')
    throw new AppError('Cross-tenant access denied', 403);
  next();
};
