const axios = require('axios');

/**
 * Evolution API client for sending WhatsApp messages.
 * Replaces the old WhatsApp Cloud API (Meta) integration.
 */

const getConfig = () => ({
  url: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
  apiKey: process.env.EVOLUTION_API_KEY || '',
  instance: process.env.EVOLUTION_INSTANCE || 'walid-bot'
});

/**
 * Send a text message via Evolution API.
 * @param {string} to - Recipient phone number (with country code, no +)
 * @param {string} text - Message body
 */
async function sendTextMessage(to, text) {
  const { url, apiKey, instance } = getConfig();
  const endpoint = `${url}/message/sendText/${encodeURIComponent(instance)}`;

  try {
    const response = await axios.post(endpoint, {
      number: to,
      text: text
    }, {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log(`✅ Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to send message to ${to}:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Extract message data from Evolution API webhook payload.
 * Evolution API v2 sends messages.upsert events with a specific format.
 * @param {object} body - Parsed webhook body
 * @returns {object|null} - { from, messageBody, messageType, messageId, name } or null
 */
function extractMessage(body) {
  try {
    // Only handle incoming messages (handle both 'messages.upsert' and 'MESSAGES_UPSERT')
    const eventName = (body.event || '').toLowerCase();
    if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') return null;

    const data = body.data;
    if (!data || !data.key) return null;

    // Ignore our own outgoing messages
    if (data.key.fromMe) return null;

    const remoteJid = data.key.remoteJid || '';

    // Only handle personal chats (skip group messages)
    if (remoteJid.includes('@g.us')) return null;

    // Extract phone number from JID (remove @s.whatsapp.net)
    const from = remoteJid.replace('@s.whatsapp.net', '');

    // Extract message text from various message types
    const message = data.message || {};
    let messageBody = '';

    if (message.conversation) {
      messageBody = message.conversation;
    } else if (message.extendedTextMessage?.text) {
      messageBody = message.extendedTextMessage.text;
    } else if (message.buttonsResponseMessage?.selectedDisplayText) {
      messageBody = message.buttonsResponseMessage.selectedDisplayText;
    } else if (message.listResponseMessage?.title) {
      messageBody = message.listResponseMessage.title;
    } else if (message.imageMessage?.caption) {
      messageBody = message.imageMessage.caption;
    }

    return {
      from,
      name: data.pushName || '',
      messageId: data.key.id,
      messageType: data.messageType || 'conversation',
      messageBody: messageBody.trim(),
      timestamp: data.messageTimestamp
    };
  } catch (err) {
    console.error('Error extracting message:', err);
    return null;
  }
}

module.exports = {
  sendTextMessage,
  extractMessage
};
