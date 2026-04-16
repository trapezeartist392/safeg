/**
 * trial.service.js
 * SafeguardsIQ — Trial Auto-Expiry + Conversion Service
 * Place in: backend/src/services/trial.service.js
 *
 * Features:
 * - Check trial expiry daily via cron
 * - Send Day 1 welcome email
 * - Send Day 25 "3 days left" warning
 * - Send Day 28 expiry email with upgrade CTA
 * - Lock dashboard on expiry — show upgrade prompt
 * - Auto-expire trial after 28 days
 */
const { getDB } = require('../config/database');
const logger    = require('../utils/logger');

// ── EMAIL TEMPLATES ──

const welcomeEmail = (name, companyName, loginUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Arial', sans-serif; background: #05080F; color: #EDF2FF; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .header { background: linear-gradient(135deg, #FF5B18, #FF8C52); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
  .body { background: #0C1422; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #1A2540; }
  .btn { display: inline-block; background: linear-gradient(135deg, #FF5B18, #FF8C52); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 20px 0; }
  .feature { padding: 12px 16px; background: #101828; border-radius: 8px; margin: 8px 0; border-left: 3px solid #FF5B18; }
  .footer { text-align: center; color: #3A4E72; font-size: 12px; margin-top: 30px; }
  h1, h2 { margin: 0; }
  p { color: #8899BB; line-height: 1.6; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1 style="color:#fff; font-size:28px; letter-spacing:2px;">SAFEGUARDSIQ</h1>
    <p style="color:rgba(255,255,255,0.8); margin:8px 0 0;">Your 28-Day Free Trial Has Started</p>
  </div>
  <div class="body">
    <h2 style="color:#EDF2FF; margin-bottom:8px;">Welcome, ${name}! 🎉</h2>
    <p>Your SafeguardsIQ AI safety monitoring trial for <strong style="color:#FF5B18;">${companyName}</strong> is now active.</p>
    
    <h3 style="color:#EDF2FF; margin:24px 0 12px;">What you can do now:</h3>
    <div class="feature">⛑️ <strong style="color:#EDF2FF;">PPE Detection</strong> — Helmet, vest, gloves, goggles and more</div>
    <div class="feature">🚧 <strong style="color:#EDF2FF;">Pathway Monitoring</strong> — Zone violations, blocked exits</div>
    <div class="feature">⚠️ <strong style="color:#EDF2FF;">Unsafe Acts</strong> — Phone use, improper lifting, machine bypass</div>
    <div class="feature">📋 <strong style="color:#EDF2FF;">Form 18 Auto-Generation</strong> — Factories Act compliant PDF</div>
    <div class="feature">📊 <strong style="color:#EDF2FF;">Compliance Reports</strong> — ISO 45001, BRSR ready</div>

    <div style="text-align:center; margin:30px 0;">
      <a href="${loginUrl}" class="btn">🚀 Open Dashboard →</a>
    </div>

    <p style="font-size:13px;">Your trial expires in <strong style="color:#FF5B18;">28 days</strong>. No credit card required during trial.</p>
    <p style="font-size:13px;">Questions? Reply to this email or WhatsApp us at <strong style="color:#00D4B4;">+91 96744 08408</strong></p>
  </div>
  <div class="footer">
    <p>SafeguardsIQ by Syyaim Enterprises · safeguardsiq.com</p>
    <p>mazhar.imam@syyaim.com · +91 96744 08408</p>
  </div>
</div>
</body>
</html>
`;

const warningEmail = (name, companyName, daysLeft, loginUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; background: #05080F; color: #EDF2FF; margin:0; padding:0; }
  .container { max-width:600px; margin:0 auto; padding:40px 20px; }
  .header { background: linear-gradient(135deg, #FFB400, #FF5B18); padding:30px; border-radius:12px 12px 0 0; text-align:center; }
  .body { background:#0C1422; padding:30px; border-radius:0 0 12px 12px; border:1px solid #1A2540; }
  .btn { display:inline-block; background:linear-gradient(135deg,#FF5B18,#FF8C52); color:#fff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:16px; margin:20px 0; }
  .warning { background:#FFB40010; border:1px solid #FFB40040; border-radius:8px; padding:16px; margin:20px 0; }
  .plan { background:#101828; border:1px solid #1A2540; border-radius:10px; padding:20px; margin:10px 0; }
  .footer { text-align:center; color:#3A4E72; font-size:12px; margin-top:30px; }
  p { color:#8899BB; line-height:1.6; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1 style="color:#fff; font-size:28px; letter-spacing:2px;">⚠️ TRIAL ENDING SOON</h1>
    <p style="color:rgba(255,255,255,0.9); margin:8px 0 0; font-size:18px;">${daysLeft} days remaining</p>
  </div>
  <div class="body">
    <h2 style="color:#EDF2FF; margin-bottom:8px;">Hi ${name},</h2>
    <div class="warning">
      <p style="color:#FFB400; margin:0; font-weight:bold;">⚠️ Your SafeguardsIQ trial for ${companyName} ends in ${daysLeft} days.</p>
      <p style="margin:8px 0 0; font-size:13px;">Upgrade now to continue protecting your workers without interruption.</p>
    </div>

    <h3 style="color:#EDF2FF; margin:24px 0 12px;">Choose your plan:</h3>
    
    <div class="plan">
      <h3 style="color:#2D8EFF; margin:0 0 4px;">STARTER — ₹2,500/camera/month</h3>
      <p style="margin:0; font-size:13px;">Up to 4 cameras · 30-day archive · Email alerts · Basic reports</p>
    </div>
    <div class="plan" style="border-color:#FF5B1840;">
      <h3 style="color:#FF5B18; margin:0 0 4px;">PROFESSIONAL — ₹2,000/camera/month ⭐ Most Popular</h3>
      <p style="margin:0; font-size:13px;">5-16 cameras · 90-day archive · WhatsApp alerts · Form 18 · Compliance reports</p>
    </div>
    <div class="plan">
      <h3 style="color:#00D4B4; margin:0 0 4px;">ENTERPRISE — ₹1,600/camera/month</h3>
      <p style="margin:0; font-size:13px;">17-32 cameras · Multi-plant · Dedicated CSM · Custom reports · 99.5% SLA</p>
    </div>

    <div style="text-align:center; margin:30px 0;">
      <a href="${loginUrl}/billing" class="btn">🚀 Upgrade Now — Save 15% Annual</a>
    </div>

    <p style="font-size:13px; text-align:center;">
      Or call us: <strong style="color:#00D4B4;">+91 96744 08408</strong> · 
      Email: <strong style="color:#FF5B18;">mazhar.imam@syyaim.com</strong>
    </p>
    <p style="font-size:12px; color:#3A4E72; text-align:center;">
      Remember: One prevented accident pays for 3 years of SafeguardsIQ
    </p>
  </div>
  <div class="footer">
    <p>SafeguardsIQ by Syyaim Enterprises · safeguardsiq.com</p>
  </div>
</div>
</body>
</html>
`;

const expiredEmail = (name, companyName, loginUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family:Arial,sans-serif; background:#05080F; color:#EDF2FF; margin:0; padding:0; }
  .container { max-width:600px; margin:0 auto; padding:40px 20px; }
  .header { background:linear-gradient(135deg,#FF3D3D,#FF5B18); padding:30px; border-radius:12px 12px 0 0; text-align:center; }
  .body { background:#0C1422; padding:30px; border-radius:0 0 12px 12px; border:1px solid #1A2540; }
  .btn { display:inline-block; background:linear-gradient(135deg,#FF5B18,#FF8C52); color:#fff; padding:16px 40px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:18px; margin:20px 0; }
  .stat { background:#101828; border-radius:8px; padding:16px; margin:8px 0; display:flex; justify-content:space-between; align-items:center; }
  .footer { text-align:center; color:#3A4E72; font-size:12px; margin-top:30px; }
  p { color:#8899BB; line-height:1.6; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1 style="color:#fff; font-size:28px; letter-spacing:2px;">TRIAL EXPIRED</h1>
    <p style="color:rgba(255,255,255,0.9); margin:8px 0 0;">Your 28-day trial for ${companyName} has ended</p>
  </div>
  <div class="body">
    <h2 style="color:#EDF2FF; margin-bottom:8px;">Hi ${name},</h2>
    <p>Your SafeguardsIQ free trial has expired. Your workers are no longer being monitored by AI.</p>
    <p style="color:#FF3D3D; font-weight:bold;">⚠️ Every hour without SafeguardsIQ is an hour your factory is unprotected.</p>

    <h3 style="color:#EDF2FF; margin:24px 0 12px;">Your trial results:</h3>
    <div class="stat">
      <span style="color:#8899BB;">Violations detected</span>
      <span style="color:#FF3D3D; font-weight:bold; font-size:18px;">${companyName} Trial</span>
    </div>
    <div class="stat">
      <span style="color:#8899BB;">Near misses prevented</span>
      <span style="color:#22D468; font-weight:bold;">See dashboard</span>
    </div>

    <div style="text-align:center; margin:30px 0;">
      <p style="color:#EDF2FF; font-size:18px; font-weight:bold; margin-bottom:8px;">
        One prevented accident = 3 years of SafeguardsIQ
      </p>
      <a href="${loginUrl}/billing" class="btn">🔓 Reactivate Now →</a>
    </div>

    <p style="font-size:13px; text-align:center;">
      Call us now: <strong style="color:#00D4B4;">+91 96744 08408</strong>
    </p>
  </div>
  <div class="footer">
    <p>SafeguardsIQ by Syyaim Enterprises · safeguardsiq.com</p>
  </div>
</div>
</body>
</html>
`;

// ── SEND EMAIL HELPER ──
const sendEmail = async (to, subject, html) => {
  try {
    const emailSvc = require('./email.service');
    await emailSvc.sendEmail({ to, subject, html });
    logger.info(`[TRIAL] Email sent to ${to}: ${subject}`);
  } catch(e) {
    logger.warn(`[TRIAL] Email failed to ${to}: ${e.message}`);
  }
};

// ── MAIN: Check and process trial expirations ──
exports.processTrials = async () => {
  const db = getDB();
  const baseUrl = process.env.FRONTEND_URL || 'https://safeguardsiq.com';

  try {
    // Get all trial tenants
    const { rows: tenants } = await db.query(`
      SELECT t.id, t.company_name, t.trial_ends_at, t.subscription_status,
             t.trial_email_sent,
             u.email, u.full_name
      FROM tenants t
      JOIN users u ON u.tenant_id = t.id AND u.role = 'customer_admin'
      WHERE t.subscription_status = 'trial'
        AND t.trial_ends_at IS NOT NULL
      ORDER BY t.trial_ends_at ASC
    `);

    const now = new Date();

    for (const tenant of tenants) {
      const trialEnd   = new Date(tenant.trial_ends_at);
      const daysLeft   = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      const emailsSent = tenant.trial_email_sent || [];

      // Day 1 — Welcome email (send once on first check)
      if (!emailsSent.includes('welcome')) {
        await sendEmail(
          tenant.email,
          `Welcome to SafeguardsIQ — Your 28-day trial has started! 🚀`,
          welcomeEmail(tenant.full_name, tenant.company_name, baseUrl)
        );
        await db.query(
          `UPDATE tenants SET trial_email_sent = array_append(COALESCE(trial_email_sent,'{}'), 'welcome') WHERE id = $1`,
          [tenant.id]
        );
        logger.info(`[TRIAL] Welcome email sent to ${tenant.email}`);
      }

      // Day 25 (3 days left) — Warning email
      if (daysLeft <= 3 && daysLeft > 0 && !emailsSent.includes('warning3')) {
        await sendEmail(
          tenant.email,
          `⚠️ Only ${daysLeft} days left in your SafeguardsIQ trial — Upgrade now`,
          warningEmail(tenant.full_name, tenant.company_name, daysLeft, baseUrl)
        );
        await db.query(
          `UPDATE tenants SET trial_email_sent = array_append(COALESCE(trial_email_sent,'{}'), 'warning3') WHERE id = $1`,
          [tenant.id]
        );
        logger.info(`[TRIAL] Warning email sent to ${tenant.email} (${daysLeft} days left)`);
      }

      // Day 21 (7 days left) — First warning
      if (daysLeft <= 7 && daysLeft > 3 && !emailsSent.includes('warning7')) {
        await sendEmail(
          tenant.email,
          `⚠️ ${daysLeft} days left in your SafeguardsIQ trial`,
          warningEmail(tenant.full_name, tenant.company_name, daysLeft, baseUrl)
        );
        await db.query(
          `UPDATE tenants SET trial_email_sent = array_append(COALESCE(trial_email_sent,'{}'), 'warning7') WHERE id = $1`,
          [tenant.id]
        );
        logger.info(`[TRIAL] Warning7 email sent to ${tenant.email}`);
      }

      // Trial expired
      if (daysLeft <= 0 && !emailsSent.includes('expired')) {
        // Mark as expired
        await db.query(
          `UPDATE tenants SET subscription_status = 'expired' WHERE id = $1`,
          [tenant.id]
        );
        // Send expiry email
        await sendEmail(
          tenant.email,
          `Your SafeguardsIQ trial has expired — Reactivate now`,
          expiredEmail(tenant.full_name, tenant.company_name, baseUrl)
        );
        await db.query(
          `UPDATE tenants SET trial_email_sent = array_append(COALESCE(trial_email_sent,'{}'), 'expired') WHERE id = $1`,
          [tenant.id]
        );
        logger.info(`[TRIAL] Trial expired for ${tenant.company_name} (${tenant.email})`);
      }
    }

    logger.info(`[TRIAL] Processed ${tenants.length} trial tenants`);
  } catch(e) {
    logger.error(`[TRIAL] processTrials error: ${e.message}`);
  }
};

// ── CHECK: Is tenant trial still valid? ──
exports.checkTrialAccess = async (tenantId) => {
  const db = getDB();
  try {
    const { rows } = await db.query(
      `SELECT subscription_status, trial_ends_at, plan_id FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (!rows.length) return { allowed: false, reason: 'Tenant not found' };

    const tenant = rows[0];
    if (tenant.subscription_status === 'active') return { allowed: true };
    if (tenant.subscription_status === 'expired') {
      return { allowed: false, reason: 'trial_expired', daysLeft: 0 };
    }
    if (tenant.subscription_status === 'trial') {
      const daysLeft = Math.ceil(
        (new Date(tenant.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 0) {
        await db.query(
          `UPDATE tenants SET subscription_status = 'expired' WHERE id = $1`,
          [tenantId]
        );
        return { allowed: false, reason: 'trial_expired', daysLeft: 0 };
      }
      return { allowed: true, daysLeft, isTrialMode: true };
    }
    return { allowed: true };
  } catch(e) {
    logger.error(`[TRIAL] checkTrialAccess error: ${e.message}`);
    return { allowed: true }; // fail open — don't block on DB error
  }
};
