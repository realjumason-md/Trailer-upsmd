/**
 * EXPRESS SERVER
 * Keeps the bot alive on Vercel, Wispbyte, Railway, etc.
 * Also provides a pairing endpoint and status endpoint.
 */

const express = require('express');
const config = require('./config');

const app = express();
app.use(express.json());

// Global bot reference (set from index.js)
let botSock = null;
let pairingCodeCache = null;

function setBotSocket(sock) {
  botSock = sock;
}

function setPairingCode(code) {
  pairingCodeCache = code;
}

// Root — keep-alive ping
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: config.BOT_NAME,
    connected: !!botSock?.user,
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Pairing code endpoint
app.get('/pair', (req, res) => {
  if (pairingCodeCache) {
    res.json({
      success: true,
      code: pairingCodeCache,
      phone: config.PAIRING_PHONE,
      instructions: `Open WhatsApp > Linked Devices > Link a Device > Enter code: ${pairingCodeCache}`,
    });
  } else {
    res.json({
      success: false,
      message: botSock?.user ? 'Already connected, no pairing needed.' : 'Pairing code not yet generated.',
    });
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  const { getAIStatus } = require('./plugins/ai');
  res.json({
    bot: config.BOT_NAME,
    owner: config.OWNER_NUMBER,
    connected: !!botSock?.user,
    user: botSock?.user || null,
    config: {
      prefix: config.PREFIX,
      antiDelete: config.ANTI_DELETE,
      antiEdit: config.ANTI_EDIT,
      autoStatusView: config.AUTO_STATUS_VIEW,
      autoBio: config.AUTO_BIO,
    },
    ai: getAIStatus(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

function startServer() {
  const port = config.PORT || 3000;
  app.listen(port, () => {
    console.log(`[Server] Running on port ${port}`);
    console.log(`[Server] Status: http://localhost:${port}/status`);
    console.log(`[Server] Pairing: http://localhost:${port}/pair`);
  });
  return app;
}

module.exports = { startServer, setBotSocket, setPairingCode, app };
