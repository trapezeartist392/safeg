/**
 * SafeG AI — Email Service (Nodemailer)
 * Sends transactional emails: password reset, welcome, alerts
 */
const nodemailer = require('nodemailer');
const logger     = require('../utils/logger');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  // If no SMTP config, use a no-op logger transport for dev
  if (!process.env.SMTP_HOST || process.env.SMTP_HOST === 'smtp.gmail.com' && !process.env.SMTP_PASS) {
    transporter = {
      sendMail: async (opts) => {
        logger.info(`[EMAIL STUB] To: ${opts.to} | Subject: ${opts.subject}`);
        return { messageId: 'stub-' + Date.now() };
      }
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

/**
 * Send an email
 * @param {Object} opts - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from:    process.env.EMAIL_FROM || '"SafeG AI" <alerts@syyaimsafeg.ai>',
      to,
      subject,
      html:    html || text,
      text:    text || html?.replace(/<[^>]+>/g, ''),
    });
    logger.info(`Email sent to ${to} — ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    // Don't throw — email failure should not crash the request
    return null;
  }
};

/**
 * Send welcome email after onboarding
 */
const sendWelcomeEmail = async ({ to, fullName, companyName, loginUrl }) => {
  return sendEmail({
    to,
    subject: `Welcome to SafeG AI — ${companyName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#FF4D00">Welcome to Syyaim SafeG AI</h2>
        <p>Hi ${fullName},</p>
        <p>Your SafeG AI account for <strong>${companyName}</strong> is now active.</p>
        <p><a href="${loginUrl || process.env.API_BASE_URL}" 
              style="background:#FF4D00;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px">
          Login to Dashboard
        </a></p>
        <p style="color:#666;font-size:12px">SafeG AI — Protecting India's factory workers</p>
      </div>
    `,
  });
};

/**
 * Send violation alert email
 */
const sendViolationAlert = async ({ to, violationType, area, plant, severity, frameUrl }) => {
  const color = severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : '#d97706';
  return sendEmail({
    to,
    subject: `[${severity?.toUpperCase()}] PPE Violation — ${plant}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:${color}">⚠️ PPE Violation Detected</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Type</strong></td>
              <td style="padding:8px;border:1px solid #ddd">${violationType}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Area</strong></td>
              <td style="padding:8px;border:1px solid #ddd">${area}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Plant</strong></td>
              <td style="padding:8px;border:1px solid #ddd">${plant}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Severity</strong></td>
              <td style="padding:8px;border:1px solid #ddd;color:${color}"><strong>${severity}</strong></td></tr>
        </table>
        ${frameUrl ? `<img src="${frameUrl}" style="width:100%;margin-top:16px" />` : ''}
        <p style="color:#666;font-size:12px;margin-top:16px">SafeG AI Automated Alert</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendWelcomeEmail, sendViolationAlert };
