const axios = require('axios');

async function sendWhatsAppAlert(opts) {
  const { violation, camera, zone, time, confidence } = opts;
  try {
    const token    = process.env.WHATSAPP_TOKEN;
    const phoneId  = process.env.WHATSAPP_PHONE_ID;
    const template = process.env.WHATSAPP_TEMPLATE || 'safeguardsiq_violation_alert';
    const numbers  = opts.numbers || (process.env.WHATSAPP_ALERT_NUMBERS || '').split(',').filter(Boolean);
    if (!token || !phoneId || numbers.length === 0) {
      console.warn('WhatsApp not configured');
      return;
    }
    for (const number of numbers) {
      const res = await axios.post(
        'https://graph.facebook.com/v18.0/' + phoneId + '/messages',
        {
          messaging_product: 'whatsapp',
          to: number.trim(),
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            components: [{ type: 'body', parameters: [
              { type: 'text', text: String(violation) },
              { type: 'text', text: String(camera) },
              { type: 'text', text: String(zone) },
              { type: 'text', text: String(time) },
              { type: 'text', text: String(confidence) },
            ]}]
          }
        },
        { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } }
      );
      console.log('WhatsApp sent to ' + number);
    }
  } catch (err) {
    console.warn('WhatsApp error:', err.message);
  }
}

module.exports = { sendWhatsAppAlert };
