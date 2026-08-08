const axios = require('axios');
const crypto = require('crypto');

const GRAPH_API_URL = 'https://graph.facebook.com/v21.0';

/**
 * Send a text message via WhatsApp Cloud API.
 * @param {string} to - Recipient phone number (with country code, no +)
 * @param {string} text - Message body
 */
async function sendTextMessage(to, text) {
  const url = `${GRAPH_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: { body: text }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send message to ${to}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send an interactive list message for group selection.
 * @param {string} to - Recipient phone number
 * @param {string} headerText - Header text
 * @param {string} bodyText - Body text
 * @param {Array} rows - Array of { id, title, description } for list items
 */
async function sendInteractiveList(to, headerText, bodyText, rows) {
  const url = `${GRAPH_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: headerText },
        body: { text: bodyText },
        action: {
          button: 'اختر مجموعة',
          sections: [{
            title: 'المجموعات المتاحة',
            rows: rows
          }]
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Interactive list sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send interactive list to ${to}:`, error.response?.data || error.message);
    // Fallback to text message if interactive fails
    console.log('⚠️ Falling back to text message...');
    return sendTextMessage(to, `${bodyText}\n\nاكتب رقم المجموعة للاختيار.`);
  }
}

/**
 * Validate the X-Hub-Signature-256 header to verify webhook authenticity.
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header value
 * @returns {boolean}
 */
function validateSignature(rawBody, signature) {
  if (!process.env.WHATSAPP_APP_SECRET || !signature) return true; // Skip if not configured

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extract message data from the webhook payload.
 * @param {object} body - Parsed webhook body
 * @returns {object|null} - { from, messageBody, messageType, messageId } or null
 */
function extractMessage(body) {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Check if it's a message (not a status update)
    if (!value?.messages || value.messages.length === 0) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    return {
      from: message.from,
      name: contact?.profile?.name || '',
      messageId: message.id,
      messageType: message.type,
      messageBody: message.type === 'text'
        ? message.text.body.trim()
        : message.type === 'interactive'
          ? (message.interactive?.list_reply?.id || message.interactive?.button_reply?.id || '')
          : '',
      timestamp: message.timestamp
    };
  } catch (err) {
    console.error('Error extracting message:', err);
    return null;
  }
}

module.exports = {
  sendTextMessage,
  sendInteractiveList,
  validateSignature,
  extractMessage
};
