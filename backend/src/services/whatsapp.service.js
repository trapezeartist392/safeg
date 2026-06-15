const axios = require('axios');

const BASE_URL = 'https://graph.facebook.com/v21.0'; // updated from v18.0

function formatNumber(number) {
  return number.trim().replace(/\s+/g, '').replace(/^\+?/, '+');
}

// ── Violation alert (uses approved template) ──────────────────
async function sendWhatsAppAlert(opts) {
  const { violation, camera, zone, time, confidence } = opts;
  try {
    const token    = process.env.WHATSAPP_TOKEN;
    const phoneId  = process.env.WHATSAPP_PHONE_ID;
    const template = process.env.WHATSAPP_TEMPLATE || 'safeguardsiq_violation_alert';
    const numbers  = opts.numbers || (process.env.WHATSAPP_ALERT_NUMBERS || '').split(',').filter(Boolean);

    if (!token || !phoneId || numbers.length === 0) {
      console.warn('[WhatsApp] Not configured — skipping alert');
      return;
    }

    for (const number of numbers) {
      const to = formatNumber(number);
      const res = await axios.post(
        `${BASE_URL}/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            components: [{ type: 'body', parameters: [
              { type: 'text', text: String(violation) },
              { type: 'text', text: String(camera) },
              { type: 'text', text: String(zone) },
              { type: 'text', text: String(time) },
              // Clean confidence display: 95.00 → "95%"
              { type: 'text', text: String(Math.round(Number(confidence))) + '%' },
            ]}]
          }
        },
        { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
      );
      // Log message ID for delivery tracking
      const msgId = res.data?.messages?.[0]?.id;
      console.log(`[WhatsApp] Alert sent to ${to} — message ID: ${msgId || 'unknown'}`);
    }
  } catch (err) {
    // Log full error for debugging Meta 400 errors
    const detail = err.response?.data?.error?.message || err.message;
    console.warn('[WhatsApp] Alert error:', detail);
  }
}

// ── Free-form text (trial expiry, password reset) ─────────────
// NOTE: Meta only allows free-form text within 24hr of user last messaging.
// Outside that window, Meta returns 400. This is a Meta platform limitation.
// For users outside the 24hr window, consider using a template instead.
async function sendWhatsAppText(number, message) {
  try {
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId || !number) {
      console.warn('[WhatsApp] Not configured for text message');
      return;
    }

    const to = formatNumber(number);
    const res = await axios.post(
      `${BASE_URL}/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      },
      { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
    );
    const msgId = res.data?.messages?.[0]?.id;
    console.log(`[WhatsApp] Text sent to ${to} — message ID: ${msgId || 'unknown'}`);
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.warn('[WhatsApp] Text error:', detail);
    // Common: 131047 = outside 24hr window, 131030 = recipient not on WhatsApp
    if (err.response?.data?.error?.code === 131047) {
      console.warn('[WhatsApp] 24hr window expired — user must message first');
    }
  }
}

module.exports = { sendWhatsAppAlert, sendWhatsAppText };
