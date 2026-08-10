const express = require('express');
const router = express.Router();
const { extractMessage } = require('../bot/whatsapp');
const { handleMessage } = require('../bot/messageHandler');

/**
 * POST /webhook
 * Receives incoming WhatsApp messages from Evolution API.
 * Evolution API sends webhook events for messages.upsert, connection.update, etc.
 * We only process messages.upsert events.
 */
router.post('/', (req, res) => {
  // Always respond 200 immediately (Evolution API requirement)
  res.sendStatus(200);

  // Extract message data from Evolution API webhook format
  const messageData = extractMessage(req.body);
  if (!messageData) return; // Not a message event, or our own message

  console.log(`📩 Message from ${messageData.from}: "${messageData.messageBody}"`);

  // Process message asynchronously
  handleMessage(messageData).catch(err => {
    console.error('Error handling message:', err);
  });
});

module.exports = router;
