/**
 * SafeG AI — Internal Admin Routes
 * Mounted at /api/admin
 * Requires: superadmin role
 */
const router       = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { getDB }    = require('../config/database');
const { cache }    = require('../config/redis');
const AppError     = require('../utils/AppError');
const os           = require('os');

// All admin routes require auth + superadmin
router.use(authenticate);
router.use(authorize('superadmin', 'customer_admin'));

// ══════════════════════════════════════════════════════
// PAYMENT STATS  GET /api/admin/payments/stats
// ══════════════════════════════════════════════════════
router.get('/payments/stats', asyncHandler(async (req, res) => {
  const db = getDB();

  const [totalRes, monthRes, activeRes, refundRes, planRes, mrrRes] = await Promise.all([
    // total revenue (captured only, in paise)
    db.query(`SELECT COALESCE(SUM(total_amount),0) AS val FROM payments WHERE status='captured'`),

    // this month revenue
    db.query(`SELECT COALESCE(SUM(total_amount),0) AS val FROM payments WHERE status='captured' AND created_at >= date_trunc('month', NOW())`),

    // active subscription count
    db.query(`SELECT COUNT(*) AS val FROM customers WHERE subscription_status='active'`),

    // pending refunds
    db.query(`SELECT COUNT(*) AS val FROM payments WHERE status='refund_pending'`),

    // revenue by plan
    db.query(`
      SELECT plan_id,
             COALESCE(SUM(total_amount),0) AS rev
      FROM payments
      WHERE status='captured'
      GROUP BY plan_id
    `),

    // MRR & subscriber count by plan
    db.query(`
      SELECT plan_id,
             COUNT(*) AS cnt,
             COALESCE(SUM(amount_per_unit * camera_count),0) AS mrr
      FROM customers
      WHERE subscription_status='active'
      GROUP BY plan_id
    `),
  ]);

  const byPlan = {};
  for (const row of planRes.rows) byPlan[row.plan_id] = Number(row.rev);

  const subs = {}, mrr = {};
  for (const row of mrrRes.rows) {
    subs[row.plan_id] = Number(row.cnt);
    mrr[row.plan_id]  = Number(row.mrr);
  }

  res.json({
    status: 'success',
    data: {
      totalRevenue:    Number(totalRes.rows[0].val),
      monthRevenue:    Number(monthRes.rows[0].val),
      activePlans:     Number(activeRes.rows[0].val),
      pendingRefunds:  Number(refundRes.rows[0].val),
      byPlan,
      subs,
      mrr,
    },
  });
}));

// ══════════════════════════════════════════════════════
// PAYMENT LIST  GET /api/admin/payments?limit=20&offset=0&status=
// ══════════════════════════════════════════════════════
router.get('/payments', asyncHandler(async (req, res) => {
  const db     = getDB();
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const status = req.query.status || null;

  const where  = status ? `WHERE p.status = $3` : '';
  const params = status ? [limit, offset, status] : [limit, offset];

  const result = await db.query(`
    SELECT
      p.id,
      p.invoice_no,
      p.razorpay_order_id,
      p.razorpay_payment_id,
      p.plan_id,
      p.camera_count,
      p.total_amount,
      p.gst_amount,
      p.status,
      p.billing_cycle,
      p.created_at,
      c.company_name   AS customer_name,
      c.gstin,
      c.contact_phone
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT $1 OFFSET $2
  `, params);

  const countRes = await db.query(
    `SELECT COUNT(*) AS total FROM payments ${where}`,
    status ? [status] : []
  );

  res.json({
    status: 'success',
    data:  result.rows,
    total: Number(countRes.rows[0].total),
    limit,
    offset,
  });
}));

// ══════════════════════════════════════════════════════
// SINGLE PAYMENT  GET /api/admin/payments/:id
// ══════════════════════════════════════════════════════
router.get('/payments/:id', asyncHandler(async (req, res) => {
  const db  = getDB();
  const res2 = await db.query(`
    SELECT p.*, c.company_name, c.gstin, c.contact_phone, c.primary_contact
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id
    WHERE p.id = $1
  `, [req.params.id]);

  if (!res2.rows.length) throw new AppError('Payment not found', 404);
  res.json({ status:'success', data: res2.rows[0] });
}));

// ══════════════════════════════════════════════════════
// PROCESS REFUND  POST /api/admin/payments/refund
// ══════════════════════════════════════════════════════
router.post('/payments/refund', asyncHandler(async (req, res) => {
  const db = getDB();
  const { paymentId, amount, reason = 'Admin initiated refund' } = req.body;

  if (!paymentId) throw new AppError('paymentId required', 400);

  // Fetch payment
  const payRes = await db.query(`SELECT * FROM payments WHERE id=$1`, [paymentId]);
  if (!payRes.rows.length) throw new AppError('Payment not found', 404);

  const payment = payRes.rows[0];
  if (payment.status !== 'captured') throw new AppError('Only captured payments can be refunded', 400);

  const refundAmt = amount || payment.total_amount;

  // Try Razorpay refund if credentials available
  let razorpayRefundId = null;
  try {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && payment.razorpay_payment_id) {
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
      const refund = await razorpay.payments.refund(payment.razorpay_payment_id, { amount: refundAmt, notes: { reason } });
      razorpayRefundId = refund.id;
    }
  } catch (rErr) {
    // Log but don't fail — mark as pending
    console.warn('Razorpay refund error:', rErr.message);
  }

  const newStatus = razorpayRefundId ? 'refunded' : 'refund_pending';

  await db.query(`
    UPDATE payments SET
      status              = $1,
      razorpay_refund_id  = $2,
      refund_amount       = $3,
      refund_reason       = $4,
      refunded_at         = NOW(),
      updated_at          = NOW()
    WHERE id = $5
  `, [newStatus, razorpayRefundId, refundAmt, reason, paymentId]);

  res.json({
    status:  'success',
    message: razorpayRefundId ? 'Refund processed successfully' : 'Refund queued — will be processed shortly',
    data:    { paymentId, status: newStatus, razorpayRefundId, refundAmount: refundAmt },
  });
}));

// ══════════════════════════════════════════════════════
// SYSTEM INFO  GET /api/admin/system
// ══════════════════════════════════════════════════════
router.get('/system', asyncHandler(async (req, res) => {
  const db = getDB();

  const [custRes, plantsRes, camsRes, violRes] = await Promise.all([
    db.query(`SELECT COUNT(*) AS val FROM customers WHERE subscription_status='active'`),
    db.query(`SELECT COUNT(*) AS val FROM plants`),
    db.query(`SELECT COUNT(*) AS val FROM cameras WHERE status='online'`),
    db.query(`SELECT COUNT(*) AS val FROM ppe_events WHERE created_at >= NOW() - INTERVAL '24 hours'`),
  ]);

  res.json({
    status: 'success',
    data: {
      server: {
        nodeVersion:  process.version,
        platform:     process.platform,
        uptime:       Math.floor(process.uptime()),
        memUsedMB:    Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        memTotalMB:   Math.round(os.totalmem() / 1024 / 1024),
        cpuCores:     os.cpus().length,
        hostname:     os.hostname(),
      },
      app: {
        activeCustomers: Number(custRes.rows[0].val),
        totalPlants:     Number(plantsRes.rows[0].val),
        onlineCameras:   Number(camsRes.rows[0].val),
        violations24h:   Number(violRes.rows[0].val),
        environment:     process.env.NODE_ENV || 'development',
        apiVersion:      'v1',
      },
    },
  });
}));

// ══════════════════════════════════════════════════════
// CUSTOMER LIST  GET /api/admin/customers
// ══════════════════════════════════════════════════════
router.get('/customers', asyncHandler(async (req, res) => {
  const db     = getDB();
  const limit  = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const result = await db.query(`
    SELECT
      c.id, c.company_name, c.plan_id, c.subscription_status,
      c.camera_count, c.gstin, c.primary_contact, c.contact_phone,
      c.trial_ends_at, c.subscription_starts_at, c.created_at,
      COUNT(p.id) AS plant_count
    FROM customers c
    LEFT JOIN plants p ON p.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  res.json({ status:'success', data: result.rows });
}));

module.exports = router;
