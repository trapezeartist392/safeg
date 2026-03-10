/**
 * SafeG AI — Razorpay Payment Backend
 * ─────────────────────────────────────
 * Routes:
 *   POST /api/v1/payments/create-order       → creates Razorpay order
 *   POST /api/v1/payments/verify             → verifies signature + activates plan
 *   POST /api/v1/payments/create-subscription → recurring billing
 *   POST /api/v1/payments/validate-coupon    → checks coupon code
 *   GET  /api/v1/payments/history            → invoice history
 *   GET  /api/v1/payments/:id                → single payment detail
 *   POST /api/v1/payments/refund             → initiate refund
 *   POST /api/v1/payments/webhook            → Razorpay webhook handler (raw body)
 *
 * Add to app.js:
 *   app.use(`${v1}/payments`, require('./routes/payment.routes'));
 */

const Razorpay  = require("razorpay");
const crypto    = require("crypto");
const express   = require("express");
const router    = express.Router();
const { getDB, withTransaction } = require("../config/database");
const { cache }     = require("../config/redis");
const { auditLog }  = require("../services/audit.service");
const { sendEmail } = require("../services/alert.service");
const { authenticate } = require("../middleware/auth");
const { broadcast }    = require("../websocket/wsServer");
const AppError     = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const logger       = require("../utils/logger");

/* ─── Razorpay instance ──────────────────────────── */
const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ─── Plan price matrix (paise — INR × 100) ────── */
const PLAN_PRICES = {
  starter:  { monthly: 960000,   annual: 9600000   },   // ₹9,600/mo · ₹96,000/yr
  growth:   { monthly: 5760000,  annual: 57600000  },   // ₹57,600/mo · ₹5,76,000/yr
  enterprise:{ monthly: null,    annual: null       },   // custom
};

const ADD_ON_PRICES = {
  extra_cameras_8: 960000,
  sms_alerts:      240000,
  data_extension:  1200000,
  onsite_training: 2500000,
};

const VALID_COUPONS = {
  SAFEG20:  { discount: 0.20, maxUses: 100, description: "20% off — Launch offer" },
  LAUNCH15: { discount: 0.15, maxUses: 200, description: "15% off — Limited time" },
  INDIA10:  { discount: 0.10, maxUses: 999, description: "10% off — India campaign" },
};

/* ═══════════════════════════════════════════════════
   DB SCHEMA (add to migrate.js)
   ═══════════════════════════════════════════════════ */
const PAYMENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID REFERENCES tenants(id),
  customer_id         UUID REFERENCES customers(id),
  -- Razorpay IDs
  razorpay_order_id   VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100),
  razorpay_signature  VARCHAR(500),
  razorpay_sub_id     VARCHAR(100),   -- for subscriptions
  -- Plan info
  plan_id             VARCHAR(30) NOT NULL,
  billing_cycle       VARCHAR(10) NOT NULL DEFAULT 'monthly',
  add_ons             TEXT[],
  coupon_code         VARCHAR(30),
  -- Amounts (in paise)
  base_amount         BIGINT NOT NULL,
  discount_amount     BIGINT DEFAULT 0,
  gst_amount          BIGINT NOT NULL,
  total_amount        BIGINT NOT NULL,
  currency            VARCHAR(5) DEFAULT 'INR',
  -- Billing details
  customer_name       VARCHAR(200),
  customer_email      VARCHAR(255),
  customer_mobile     VARCHAR(20),
  company_name        VARCHAR(300),
  gstin               VARCHAR(20),
  billing_address     TEXT,
  billing_city        VARCHAR(100),
  billing_state       VARCHAR(100),
  -- Status
  status              VARCHAR(30) DEFAULT 'created',
  -- created | authorized | captured | failed | refunded | partially_refunded
  failure_reason      TEXT,
  refund_id           VARCHAR(100),
  refunded_at         TIMESTAMPTZ,
  -- Invoice
  invoice_no          VARCHAR(30),
  invoice_pdf_url     VARCHAR(500),
  -- Metadata
  notes               JSONB DEFAULT '{}',
  webhook_events      JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant   ON payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_rzp_order ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_rzp_pay   ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON payments(status);

-- Auto invoice number
CREATE OR REPLACE FUNCTION generate_invoice_no()
RETURNS TRIGGER AS $$
DECLARE yr TEXT; seq INT;
BEGIN
  yr  := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*)+1 INTO seq FROM payments WHERE invoice_no LIKE 'INV-'||yr||'-%';
  NEW.invoice_no := 'INV-' || yr || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_invoice_no ON payments;
CREATE TRIGGER trg_invoice_no BEFORE INSERT ON payments FOR EACH ROW
  WHEN (NEW.invoice_no IS NULL) EXECUTE FUNCTION generate_invoice_no();
`;

/* ─── Helper: calculate order amount ─────────────── */
function calculateAmount(planId, billing, addOns = [], couponCode = null) {
  const prices = PLAN_PRICES[planId];
  if (!prices || prices[billing] === null) {
    throw new AppError("Custom pricing — contact sales", 400);
  }

  const base      = prices[billing];
  const addOnSum  = addOns.reduce((s, id) => s + (ADD_ON_PRICES[id] || 0), 0);
  const subtotal  = base + addOnSum;

  let discountAmt = 0;
  let couponMeta  = null;
  if (couponCode) {
    const c = VALID_COUPONS[couponCode.toUpperCase()];
    if (c) {
      discountAmt = Math.round(subtotal * c.discount);
      couponMeta  = c;
    }
  }

  const afterDisc = subtotal - discountAmt;
  const gst       = Math.round(afterDisc * 0.18);
  const total     = afterDisc + gst;

  return { base, addOnSum, subtotal, discountAmt, gst, total, couponMeta };
}

/* ═══════════════════════════════════════════════════
   POST /payments/create-order
   ═══════════════════════════════════════════════════ */
router.post("/create-order", authenticate, asyncHandler(async (req, res) => {
  const { planId, billing = "monthly", addOns = [], coupon, customer } = req.body;

  if (!planId || !["starter","growth","enterprise"].includes(planId))
    throw new AppError("Invalid plan", 400);
  if (!["monthly","annual"].includes(billing))
    throw new AppError("Invalid billing cycle", 400);

  const amounts = calculateAmount(planId, billing, addOns, coupon);
  const db = getDB();

  // Idempotency: check for existing pending order for this tenant
  const existing = await db.query(
    `SELECT razorpay_order_id FROM payments
     WHERE tenant_id=$1 AND plan_id=$2 AND billing_cycle=$3 AND status='created'
       AND created_at > NOW()-INTERVAL '30 minutes'`,
    [req.user.tenantId, planId, billing]
  );
  if (existing.rows.length) {
    return res.json({ success: true, data: {
      orderId:  existing.rows[0].razorpay_order_id,
      amount:   amounts.total,
      currency: "INR",
      key:      process.env.RAZORPAY_KEY_ID,
      description: `${planId} Plan — ${billing}`,
      isExisting: true,
    }});
  }

  // Create Razorpay order
  const rzpOrder = await rzp.orders.create({
    amount:          amounts.total,
    currency:        "INR",
    receipt:         `safeg-${req.user.tenantId.slice(0,8)}-${Date.now()}`,
    notes: {
      tenant_id: req.user.tenantId,
      plan_id:   planId,
      billing,
      coupon:    coupon || "",
    },
    payment_capture: 1,
  });

  // Fetch customer record
  const custRes = await db.query(
    "SELECT id FROM customers WHERE tenant_id=$1 LIMIT 1", [req.user.tenantId]);

  // Save payment record
  await db.query(
    `INSERT INTO payments
       (tenant_id, customer_id, razorpay_order_id,
        plan_id, billing_cycle, add_ons, coupon_code,
        base_amount, discount_amount, gst_amount, total_amount, currency,
        customer_name, customer_email, customer_mobile, company_name,
        gstin, billing_address, billing_city, billing_state,
        status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'created',$21::jsonb)`,
    [
      req.user.tenantId, custRes.rows[0]?.id || null, rzpOrder.id,
      planId, billing, addOns, coupon?.toUpperCase() || null,
      amounts.base, amounts.discountAmt, amounts.gst, amounts.total, "INR",
      customer?.name, customer?.email, customer?.mobile, customer?.company,
      customer?.gstin, customer?.address, customer?.city, customer?.state,
      JSON.stringify({ add_ons: addOns, coupon }),
    ]
  );

  await auditLog({
    tenantId: req.user.tenantId, userId: req.user.id,
    action: "PAYMENT_ORDER_CREATED", entityType: "payment",
    entityId: rzpOrder.id,
    newData: { planId, billing, amount: amounts.total },
  });

  logger.info(`Order created: ${rzpOrder.id} — ₹${amounts.total / 100} for ${req.user.tenantId}`);

  res.json({
    success: true,
    data: {
      orderId:     rzpOrder.id,
      amount:      amounts.total,
      currency:    "INR",
      key:         process.env.RAZORPAY_KEY_ID,
      name:        "Syyaim SafeG AI",
      description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan — ${billing === "annual" ? "Annual" : "Monthly"} billing`,
      breakdown: {
        base:     amounts.base,
        addOns:   amounts.addOnSum,
        discount: amounts.discountAmt,
        gst:      amounts.gst,
        total:    amounts.total,
      },
    },
  });
}));

/* ═══════════════════════════════════════════════════
   POST /payments/verify
   Verifies Razorpay signature + activates plan
   ═══════════════════════════════════════════════════ */
router.post("/verify", authenticate, asyncHandler(async (req, res) => {
  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    planId, billing, amount, customer, addOns, coupon,
  } = req.body;

  // 1. Verify HMAC signature
  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    logger.warn(`Payment signature mismatch: order=${razorpay_order_id}`);
    throw new AppError("Payment verification failed — invalid signature", 400);
  }

  // 2. Fetch payment details from Razorpay
  const rzpPayment = await rzp.payments.fetch(razorpay_payment_id);
  if (rzpPayment.status !== "captured") {
    throw new AppError(`Payment not captured — status: ${rzpPayment.status}`, 400);
  }

  const db = getDB();

  // 3. Update payment record + activate plan (single transaction)
  const result = await withTransaction(async (client) => {

    // Update payment status
    const { rows } = await client.query(
      `UPDATE payments
       SET razorpay_payment_id=$1, razorpay_signature=$2, status='captured',
           customer_name=$3, customer_email=$4, customer_mobile=$5,
           company_name=$6, gstin=$7, billing_address=$8, billing_city=$9, billing_state=$10
       WHERE razorpay_order_id=$11 AND tenant_id=$12
       RETURNING id, invoice_no, total_amount`,
      [
        razorpay_payment_id, razorpay_signature,
        customer?.name, customer?.email, customer?.mobile,
        customer?.company, customer?.gstin, customer?.address,
        customer?.city, customer?.state,
        razorpay_order_id, req.user.tenantId,
      ]
    );

    if (!rows.length) throw new AppError("Payment record not found", 404);
    const payment = rows[0];

    // Activate plan on tenant
    const planEnd = billing === "annual"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30  * 24 * 60 * 60 * 1000);

    await client.query(
      `UPDATE tenants SET plan=$1, trial_ends_at=$2 WHERE id=$3`,
      [planId, planEnd.toISOString(), req.user.tenantId]
    );

    // Update customer plan
    await client.query(
      `UPDATE customers SET plan=$1, plan_start_date=CURRENT_DATE, plan_end_date=$2
       WHERE tenant_id=$3`,
      [planId, planEnd.toISOString().slice(0, 10), req.user.tenantId]
    );

    // Update camera limits based on plan
    const maxCameras = planId === "starter" ? 8 : planId === "growth" ? 32 : 9999;
    await client.query(
      `UPDATE tenants SET max_cameras=$1 WHERE id=$2`,
      [maxCameras, req.user.tenantId]
    );

    return { paymentId: payment.id, invoiceNo: payment.invoice_no, total: payment.total_amount };
  });

  // 4. Send receipt email
  await sendPaymentReceipt({
    email:     customer?.email || req.user.email,
    name:      customer?.name,
    invoiceNo: result.invoiceNo,
    planId, billing, amount,
    paymentId: razorpay_payment_id,
    orderId:   razorpay_order_id,
    company:   customer?.company,
    gstin:     customer?.gstin,
  });

  // 5. Broadcast plan activation to WebSocket
  broadcast(req.user.tenantId, {
    type: "plan_activated",
    data: { planId, billing, invoiceNo: result.invoiceNo },
  });

  // 6. Invalidate caches
  await cache.del(`tenant:${req.user.tenantId}`);
  await cache.del(`session:${req.user.id}`);

  await auditLog({
    tenantId: req.user.tenantId, userId: req.user.id,
    action: "PAYMENT_CAPTURED", entityType: "payment",
    entityId: razorpay_payment_id,
    newData: { planId, billing, amount: result.total },
  });

  logger.info(`Payment captured: ${razorpay_payment_id} — ₹${result.total/100} — plan: ${planId}`);

  res.json({
    success: true,
    message: "Payment verified — plan activated!",
    data: {
      paymentId:  razorpay_payment_id,
      invoiceNo:  result.invoiceNo,
      planId, billing,
      activatedAt: new Date().toISOString(),
    },
  });
}));

/* ═══════════════════════════════════════════════════
   POST /payments/create-subscription
   Razorpay recurring billing
   ═══════════════════════════════════════════════════ */
router.post("/create-subscription", authenticate, asyncHandler(async (req, res) => {
  const { planId, billing = "monthly" } = req.body;

  // Map to Razorpay plan IDs (create these in Razorpay dashboard first)
  const rzpPlanIds = {
    starter_monthly:  process.env.RZP_PLAN_STARTER_MONTHLY,
    starter_annual:   process.env.RZP_PLAN_STARTER_ANNUAL,
    growth_monthly:   process.env.RZP_PLAN_GROWTH_MONTHLY,
    growth_annual:    process.env.RZP_PLAN_GROWTH_ANNUAL,
  };
  const key = `${planId}_${billing}`;
  const rzpPlanId = rzpPlanIds[key];
  if (!rzpPlanId) throw new AppError(`No Razorpay plan configured for ${key}`, 400);

  const sub = await rzp.subscriptions.create({
    plan_id:           rzpPlanId,
    total_count:       billing === "annual" ? 1 : 12,
    quantity:          1,
    customer_notify:   1,
    notes: {
      tenant_id: req.user.tenantId,
      plan_id:   planId,
      billing,
    },
  });

  res.json({ success: true, data: {
    subscriptionId: sub.id,
    shortUrl:       sub.short_url,
    key:            process.env.RAZORPAY_KEY_ID,
  }});
}));

/* ═══════════════════════════════════════════════════
   POST /payments/validate-coupon
   ═══════════════════════════════════════════════════ */
router.post("/validate-coupon", authenticate, asyncHandler(async (req, res) => {
  const { code, planId, billing } = req.body;
  if (!code) throw new AppError("Coupon code required", 400);

  const coupon = VALID_COUPONS[code.toUpperCase()];
  if (!coupon) {
    return res.status(400).json({ success: false, message: "Invalid coupon code" });
  }

  // Check usage limit from DB
  const db = getDB();
  const { rows } = await db.query(
    "SELECT COUNT(*) FROM payments WHERE coupon_code=$1 AND status='captured'",
    [code.toUpperCase()]
  );
  if (parseInt(rows[0].count) >= coupon.maxUses) {
    return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
  }

  // Calculate savings
  const amounts = calculateAmount(planId || "growth", billing || "monthly", [], code);

  res.json({
    success: true,
    data: {
      code:        code.toUpperCase(),
      discount:    coupon.discount,
      description: coupon.description,
      savings:     amounts.discountAmt,      // in paise
      savingsINR:  amounts.discountAmt / 100,
    },
  });
}));

/* ═══════════════════════════════════════════════════
   GET /payments/history
   ═══════════════════════════════════════════════════ */
router.get("/history", authenticate, asyncHandler(async (req, res) => {
  const db = getDB();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { rows } = await db.query(
    `SELECT id, razorpay_order_id, razorpay_payment_id, plan_id, billing_cycle,
            total_amount, currency, status, invoice_no, created_at,
            customer_name, company_name, gstin, add_ons, coupon_code
     FROM payments
     WHERE tenant_id=$1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [req.user.tenantId, parseInt(limit), offset]
  );

  const { rows: cnt } = await db.query(
    "SELECT COUNT(*) FROM payments WHERE tenant_id=$1", [req.user.tenantId]);

  res.json({
    success: true,
    data: rows,
    pagination: { page: +page, limit: +limit, total: +cnt[0].count },
  });
}));

/* ═══════════════════════════════════════════════════
   GET /payments/:id
   ═══════════════════════════════════════════════════ */
router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const db = getDB();
  const { rows } = await db.query(
    "SELECT * FROM payments WHERE id=$1 AND tenant_id=$2",
    [req.params.id, req.user.tenantId]
  );
  if (!rows.length) throw new AppError("Payment not found", 404);
  res.json({ success: true, data: rows[0] });
}));

/* ═══════════════════════════════════════════════════
   POST /payments/refund
   ═══════════════════════════════════════════════════ */
router.post("/refund", authenticate, asyncHandler(async (req, res) => {
  const { paymentId, reason, amount } = req.body;  // amount in paise (partial refund)
  if (!paymentId) throw new AppError("Payment ID required", 400);

  const db = getDB();
  const { rows } = await db.query(
    "SELECT * FROM payments WHERE razorpay_payment_id=$1 AND tenant_id=$2",
    [paymentId, req.user.tenantId]
  );
  if (!rows.length) throw new AppError("Payment not found", 404);
  const pay = rows[0];
  if (pay.status === "refunded") throw new AppError("Already refunded", 400);

  // Check 7-day refund window
  const daysSince = (Date.now() - new Date(pay.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 7) throw new AppError("Refund window (7 days) has passed", 400);

  const refundAmount = amount || pay.total_amount;

  const refund = await rzp.payments.refund(paymentId, {
    amount: refundAmount,
    notes: { reason: reason || "Customer requested refund", tenant_id: req.user.tenantId },
  });

  await db.query(
    `UPDATE payments SET status=$1, refund_id=$2, refunded_at=NOW()
     WHERE razorpay_payment_id=$3`,
    [refundAmount < pay.total_amount ? "partially_refunded" : "refunded", refund.id, paymentId]
  );

  // Downgrade plan to starter if full refund
  if (refundAmount >= pay.total_amount) {
    await db.query(`UPDATE tenants SET plan='starter' WHERE id=$1`, [req.user.tenantId]);
    await db.query(`UPDATE customers SET plan='starter' WHERE tenant_id=$1`, [req.user.tenantId]);
  }

  await auditLog({
    tenantId: req.user.tenantId, userId: req.user.id,
    action: "PAYMENT_REFUNDED", entityType: "payment",
    entityId: paymentId, newData: { refundId: refund.id, amount: refundAmount },
  });

  res.json({ success: true, data: { refundId: refund.id, amount: refundAmount, status: refund.status } });
}));

/* ═══════════════════════════════════════════════════
   POST /payments/webhook
   Raw body required — add BEFORE express.json() in app.js:
   app.use('/api/v1/payments/webhook', express.raw({type:'application/json'}), webhookRouter);
   ═══════════════════════════════════════════════════ */
const webhookRouter = express.Router();

webhookRouter.post("/", asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const body = req.body;

  // Verify webhook signature
  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(Buffer.isBuffer(body) ? body : JSON.stringify(body))
    .digest("hex");

  if (signature !== expectedSig) {
    logger.warn("Webhook signature mismatch");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(Buffer.isBuffer(body) ? body.toString() : JSON.stringify(body));
  const db    = getDB();

  logger.info(`Razorpay webhook: ${event.event}`);

  switch (event.event) {

    case "payment.captured": {
      const p = event.payload.payment.entity;
      await db.query(
        `UPDATE payments SET status='captured', razorpay_payment_id=$1
         WHERE razorpay_order_id=$2`,
        [p.id, p.order_id]
      );
      break;
    }

    case "payment.failed": {
      const p = event.payload.payment.entity;
      await db.query(
        `UPDATE payments SET status='failed', failure_reason=$1
         WHERE razorpay_order_id=$2`,
        [p.error_description || "Payment failed", p.order_id]
      );
      break;
    }

    case "order.paid": {
      const order = event.payload.order.entity;
      // Extra confirmation that order is fully paid
      await db.query(
        `UPDATE payments SET status='captured' WHERE razorpay_order_id=$1 AND status!='captured'`,
        [order.id]
      );
      break;
    }

    case "subscription.activated": {
      const sub = event.payload.subscription.entity;
      const tenantId = sub.notes?.tenant_id;
      if (tenantId) {
        await db.query(`UPDATE tenants SET plan=$1 WHERE id=$2`,
          [sub.notes.plan_id || "growth", tenantId]);
        await db.query(`UPDATE customers SET plan=$1 WHERE tenant_id=$2`,
          [sub.notes.plan_id || "growth", tenantId]);
        broadcast(tenantId, { type: "subscription_activated", data: { planId: sub.notes.plan_id } });
      }
      break;
    }

    case "subscription.charged": {
      const sub = event.payload.subscription.entity;
      const pmt = event.payload.payment.entity;
      // Log recurring payment
      await db.query(
        `INSERT INTO payments
           (razorpay_order_id, razorpay_payment_id, razorpay_sub_id,
            plan_id, billing_cycle, base_amount, gst_amount, total_amount, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'captured') ON CONFLICT DO NOTHING`,
        [pmt.order_id, pmt.id, sub.id,
         sub.notes?.plan_id || "growth",
         sub.notes?.billing || "monthly",
         pmt.amount, Math.round(pmt.amount * 0.18 / 1.18),
         pmt.amount, "captured"]
      );
      break;
    }

    case "refund.created": {
      const refund = event.payload.refund.entity;
      await db.query(
        `UPDATE payments SET refund_id=$1, refunded_at=NOW(),
         status=CASE WHEN $2 >= total_amount THEN 'refunded' ELSE 'partially_refunded' END
         WHERE razorpay_payment_id=$3`,
        [refund.id, refund.amount, refund.payment_id]
      );
      break;
    }

    default:
      logger.info(`Unhandled webhook event: ${event.event}`);
  }

  // Append to webhook_events log on payment record
  try {
    const orderId = event.payload?.payment?.entity?.order_id
                 || event.payload?.order?.entity?.id;
    if (orderId) {
      await db.query(
        `UPDATE payments
         SET webhook_events = webhook_events || $1::jsonb
         WHERE razorpay_order_id=$2`,
        [JSON.stringify([{ event: event.event, at: new Date().toISOString() }]), orderId]
      );
    }
  } catch { /* non-critical */ }

  res.json({ success: true });
}));

/* ─── Receipt email ─────────────────────────────── */
async function sendPaymentReceipt({ email, name, invoiceNo, planId, billing, amount,
                                    paymentId, orderId, company, gstin }) {
  const planNames = { starter: "Starter", growth: "Growth", enterprise: "Enterprise" };
  try {
    await sendEmail({
      to:      email,
      subject: `SafeG AI — Payment Receipt ${invoiceNo}`,
      html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080D18;color:#F4F7FF;border-radius:16px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#FF4D00,#FF6B2B);padding:28px 32px">
          <div style="font-size:22px;font-weight:900;letter-spacing:2px">SAFEG AI</div>
          <div style="font-size:14px;opacity:.8;margin-top:4px">Payment Receipt</div>
        </div>
        <div style="padding:32px">
          <p style="font-size:15px;margin-bottom:24px">Hi <strong>${name || "there"}</strong>,<br>
          Thank you! Your payment was successful and your <strong style="color:#FF4D00">${planNames[planId]} Plan</strong> is now active.</p>

          <table style="width:100%;border-collapse:collapse;background:#101828;border-radius:12px;overflow:hidden">
            <tr style="border-bottom:1px solid #1C2A40">
              <td style="padding:12px 16px;color:#7B94C4;font-size:13px">Invoice No.</td>
              <td style="padding:12px 16px;font-family:monospace;font-size:13px">${invoiceNo}</td>
            </tr>
            <tr style="border-bottom:1px solid #1C2A40">
              <td style="padding:12px 16px;color:#7B94C4;font-size:13px">Plan</td>
              <td style="padding:12px 16px;font-size:13px;font-weight:700;color:#FF4D00">${planNames[planId]} — ${billing === "annual" ? "Annual" : "Monthly"}</td>
            </tr>
            ${company ? `<tr style="border-bottom:1px solid #1C2A40">
              <td style="padding:12px 16px;color:#7B94C4;font-size:13px">Company</td>
              <td style="padding:12px 16px;font-size:13px">${company}</td>
            </tr>` : ""}
            ${gstin ? `<tr style="border-bottom:1px solid #1C2A40">
              <td style="padding:12px 16px;color:#7B94C4;font-size:13px">GSTIN</td>
              <td style="padding:12px 16px;font-family:monospace;font-size:13px">${gstin}</td>
            </tr>` : ""}
            <tr style="border-bottom:1px solid #1C2A40">
              <td style="padding:12px 16px;color:#7B94C4;font-size:13px">Amount Paid</td>
              <td style="padding:12px 16px;font-size:15px;font-weight:700">₹${(amount/100).toLocaleString("en-IN")} (incl. 18% GST)</td>
            </tr>
            <tr style="border-bottom:1px solid #1C2A40">
              <td style="padding:12px 16px;color:#7B94C4;font-size:13px">Payment ID</td>
              <td style="padding:12px 16px;font-family:monospace;font-size:12px">${paymentId}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#7B94C4;font-size:13px">Date</td>
              <td style="padding:12px 16px;font-size:13px">${new Date().toLocaleString("en-IN",{dateStyle:"long",timeStyle:"short"})}</td>
            </tr>
          </table>

          <div style="margin-top:24px;padding:16px;background:rgba(0,229,160,.08);border:1px solid rgba(0,229,160,.2);border-radius:10px;font-size:13px;color:#00E5A0">
            ✓ SafeG AI is now monitoring your factory floor. <a href="https://app.syyaimsafeg.ai" style="color:#00E5A0">Go to dashboard →</a>
          </div>

          <p style="margin-top:24px;font-size:12px;color:#3A5080">
            Questions? Email <a href="mailto:billing@syyaimsafeg.ai" style="color:#FF4D00">billing@syyaimsafeg.ai</a><br>
            7-day refund policy · GST invoice available on request
          </p>
        </div>
      </div>`,
    });
  } catch (err) {
    logger.warn("Receipt email failed:", err.message);
  }
}

/* ─── Export ─────────────────────────────────────── */
module.exports = router;
