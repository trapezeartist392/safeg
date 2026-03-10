/**
 * Alert Service
 * Sends WhatsApp, Email, SMS when a violation is created/escalated
 * Looks up the correct recipient from zone → plant supervisor chain
 */
const axios        = require('axios');
const nodemailer   = require('nodemailer');
const { getDB }    = require('../config/database');
const logger       = require('../utils/logger');

// ── Email transporter
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT === '465',
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ── MAIN: send all configured alerts for a violation
exports.sendAlert = async ({ violation, tenantId, escalated = false }) => {
  const db = getDB();
  try {
    // Get plant HSE officer + supervisor for zone
    const { rows } = await db.query(
      `SELECT p.hse_name, p.hse_email, p.hse_mobile,
              u.full_name AS supervisor_name, u.email AS supervisor_email, u.mobile AS supervisor_mobile
       FROM plants p
       LEFT JOIN users u ON u.tenant_id = p.tenant_id AND u.role IN ('hse_officer','plant_manager')
         AND (u.plant_ids IS NULL OR $1 = ANY(u.plant_ids))
       WHERE p.id = $1 LIMIT 1`,
      [violation.plant_id]
    );
    const plant = rows[0] || {};

    const recipients = [
      { name: plant.hse_name,       email: plant.hse_email,       mobile: plant.hse_mobile },
      { name: plant.supervisor_name, email: plant.supervisor_email, mobile: plant.supervisor_mobile },
    ].filter(r => r.email || r.mobile);

    const message = formatMessage(violation, escalated);

    const promises = [];
    for (const r of recipients) {
      if (r.email) promises.push(sendEmailAlert(r, violation, message, tenantId));
      if (r.mobile && process.env.WHATSAPP_PROVIDER) {
        promises.push(sendWhatsApp(r, violation, message, tenantId));
      }
    }
    await Promise.allSettled(promises);
  } catch (err) {
    logger.error('Alert dispatch failed:', err.message);
  }
};

// ── FORMAT MESSAGE
function formatMessage(v, escalated) {
  const prefix = escalated ? '🚨 ESCALATED ALERT' : '⚠️ SafeG AI Alert';
  return {
    short: `${prefix}: ${v.violation_type} detected at ${v.cam_label || 'camera'} — ${v.area_name || 'zone'}. Severity: ${v.severity?.toUpperCase()}. Ref: ${v.violation_no}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;border:2px solid #FF5B18;border-radius:10px;overflow:hidden">
        <div style="background:#FF5B18;color:#fff;padding:14px 20px">
          <strong>${prefix}</strong>
        </div>
        <div style="padding:20px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#666;padding:6px 0">Violation</td><td><strong>${v.violation_type}</strong></td></tr>
            <tr><td style="color:#666;padding:6px 0">Camera</td><td>${v.cam_label || '—'}</td></tr>
            <tr><td style="color:#666;padding:6px 0">Zone</td><td>${v.area_name || '—'}</td></tr>
            <tr><td style="color:#666;padding:6px 0">Severity</td><td><strong style="color:${v.severity==='high'||v.severity==='critical'?'#FF3D3D':'#FFB400'}">${v.severity?.toUpperCase()}</strong></td></tr>
            <tr><td style="color:#666;padding:6px 0">Time</td><td>${new Date(v.occurred_at).toLocaleString('en-IN')}</td></tr>
            <tr><td style="color:#666;padding:6px 0">Ref No.</td><td style="font-family:monospace">${v.violation_no}</td></tr>
          </table>
          ${v.frame_url ? `<img src="${v.frame_url}" style="width:100%;margin-top:12px;border-radius:6px" alt="Evidence frame"/>` : ''}
          <div style="margin-top:16px">
            <a href="${process.env.API_BASE_URL}/violations/${v.id}" style="background:#FF5B18;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">
              View & Resolve →
            </a>
          </div>
        </div>
      </div>`,
  };
}

// ── EMAIL
async function sendEmailAlert(recipient, violation, message, tenantId) {
  const db = getDB();
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      recipient.email,
      subject: `SafeG AI Alert — ${violation.violation_type} | ${violation.violation_no}`,
      html:    message.html,
    });
    await logAlert(db, { tenantId, violationId: violation.id, channel: 'email',
      recipient: recipient.email, messageBody: message.short, status: 'sent' });
  } catch (err) {
    logger.error(`Email alert failed to ${recipient.email}:`, err.message);
    await logAlert(db, { tenantId, violationId: violation.id, channel: 'email',
      recipient: recipient.email, messageBody: message.short, status: 'failed', error: err.message });
  }
}

// ── WHATSAPP (Twilio)
async function sendWhatsApp(recipient, violation, message, tenantId) {
  const db = getDB();
  if (!recipient.mobile) return;

  try {
    let msgId;
    if (process.env.WHATSAPP_PROVIDER === 'twilio') {
      const { default: twilio } = await import('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const res = await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
        to:   `whatsapp:${recipient.mobile}`,
        body: message.short,
      });
      msgId = res.sid;
    } else if (process.env.WHATSAPP_PROVIDER === 'meta') {
      const res = await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.META_WA_PHONE_ID}/messages`,
        { messaging_product: 'whatsapp', to: recipient.mobile.replace('+',''),
          type: 'text', text: { body: message.short } },
        { headers: { Authorization: `Bearer ${process.env.META_WA_TOKEN}` } }
      );
      msgId = res.data.messages?.[0]?.id;
    }
    await logAlert(db, { tenantId, violationId: violation.id, channel: 'whatsapp',
      recipient: recipient.mobile, messageBody: message.short, status: 'sent', providerMsgId: msgId });
  } catch (err) {
    logger.error(`WhatsApp alert failed to ${recipient.mobile}:`, err.message);
    await logAlert(db, { tenantId, violationId: violation.id, channel: 'whatsapp',
      recipient: recipient.mobile, messageBody: message.short, status: 'failed', error: err.message });
  }
}

// ── LOG
async function logAlert(db, { tenantId, violationId, channel, recipient, messageBody, status, providerMsgId, error }) {
  await db.query(
    `INSERT INTO alert_logs (tenant_id, violation_id, channel, recipient, message_body, status, provider_msg_id, error_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [tenantId, violationId, channel, recipient, messageBody, status, providerMsgId || null, error || null]
  );
}

// ── SEND EMAIL (generic — used by auth service too)
exports.sendEmail = async ({ to, subject, html, text }) => {
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html, text });
};
