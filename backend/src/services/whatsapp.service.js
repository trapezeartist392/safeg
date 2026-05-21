const axios = require('axios');
const logger = require('../config/logger');

async function sendWhatsAppAlert({ violation, camera, zone, time, confidence }) {
  try {
    const token    = process.env.WHATSAPP_TOKEN;
    const phoneId  = process.env.WHATSAPP_PHONE_ID;
    const template = process.env.WHATSAPP_TEMPLATE || 'safeguardsiq_violation_alert';
    const numbers  = (process.env.WHATSAPP_ALERT_NUMBERS || '').split(',').filter(Boolean);

    if (!token || !phoneId || numbers.length === 0) {
      logger.warn('WhatsApp not configured — skipping alert');
      return;
    }

    for (const number of numbers) {
      const res = await axios.post(
        `https://graph.facebook.com/v18.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: number.trim(),
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: String(violation)  },
                { type: 'text', text: String(camera)     },
                { type: 'text', text: String(zone)       },
                { type: 'text', text: String(time)       },
                { type: 'text', text: String(confidence) },
              ]
            }]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      logger.info(`WhatsApp alert sent to ${number}: ${res.data?.messages?.[0]?.id}`);
    }
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    logger.warn('WhatsApp alert error: ' + errMsg);
  }
}

module.exports = { sendWhatsAppAlert };
