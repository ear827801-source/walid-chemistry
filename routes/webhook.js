const express = require('express');
const router = express.Router();
const { validateSignature, extractMessage } = require('../bot/whatsapp');
const { handleMessage } = require('../bot/messageHandler');

/**
 * GET /webhook
 * Meta verification handshake for WhatsApp Cloud API.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('⚠️ Webhook verification failed');
  return res.sendStatus(403);
});

/**
 * POST /webhook
 * Receives incoming WhatsApp messages from Meta.
 * Acknowledges immediately (200), then processes asynchronously.
 */
router.post('/', (req, res) => {
  // Always respond 200 immediately (Meta requirement)
  res.sendStatus(200);

  const body = req.body;

  if (body.object !== 'whatsapp_business_account') {
    return;
  }

  // Extract message data
  const messageData = extractMessage(body);
  if (!messageData) {
    return; // Status update or non-message event
  }

  console.log(`📩 Message from ${messageData.from}: "${messageData.messageBody}"`);

  // Process message asynchronously
  handleMessage(messageData).catch(err => {
    console.error('Error handling message:', err);
  });
});

module.exports = router;
