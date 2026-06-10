const jwt    = require('jsonwebtoken');
const { cache } = require('../config/redis');
const { getDB } = require('../config/database');
const AppError  = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Routes that expired/trial tenants can always access
// (so they can log in, pay, and reactivate)
const ALLOWED_EXPIRED_PATHS = [
  '/api/v1/auth',
  '/api/v1/payments',
  '/api/v1/trial',
  '/api/v1/billing',
  '/api/v1/admin',
  '/api/health',
  '/ai/health',
];

function isAllowedWhenExpired(req) {
  const url = req.originalUrl || req.path;
  return ALLOWED_EXPIRED_PATHS.some(prefix => url.startsWith(prefix));
}

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
    // If cached object is old schema (no subscriptionStatus), fall through to DB
    if (req.user.subscriptionStatus !== undefined) {
      if (req.user.subscriptionStatus === 'expired' && !isAllowedWhenExpired(req)) {
        throw new AppError('Trial expired — subscribe to continue', 402);
      }
      return next();
    }
    // Old cache entry — delete it and fall through to DB refresh
    await cache.del(`session:${decoded.sub}`);
  }

  // Fallback to DB — also fetch subscription_status in same query
  const db = getDB();
  const { rows } = await db.query(
    `SELECT u.id, u.tenant_id AS "tenantId", u.role, u.is_active,
            t.subscription_status AS "subscriptionStatus",
            t.trial_ends_at       AS "trialEndsAt"
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1`,
    [decoded.sub]
  );
  if (!rows.length || !rows[0].is_active) throw new AppError('User not found or inactive', 401);

  const user = rows[0];

  // Auto-expire trial if past end date
  if (user.subscriptionStatus === 'trial' && user.trialEndsAt && new Date() > new Date(user.trialEndsAt)) {
    await db.query(
      `UPDATE tenants SET subscription_status = 'expired' WHERE id = $1`,
      [user.tenantId]
    );
    user.subscriptionStatus = 'expired';
  }

  // Block expired tenants from protected routes
  if (user.subscriptionStatus === 'expired' && !isAllowedWhenExpired(req)) {
    throw new AppError('Trial expired — subscribe to continue', 402);
  }

  req.user = user;

  // Cache — shorter TTL for trial users so expiry is detected quickly
  const ttl = user.subscriptionStatus === 'trial' ? 60 : 300;
  await cache.set(`session:${decoded.sub}`, user, ttl);

  next();
});

// ── Role-based access control
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    throw new AppError(`Access denied — requires role: ${roles.join(' or ')}`, 403);
  next();
};

// ── Tenant isolation guard
exports.tenantGuard = (req, res, next) => {
  const tid = req.params.tenantId || req.body.tenantId || req.query.tenantId;
  if (tid && tid !== req.user.tenantId && req.user.role !== 'superadmin')
    throw new AppError('Cross-tenant access denied', 403);
  next();
};
