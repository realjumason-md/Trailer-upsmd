/**
 * AUTO STATUS VIEW PLUGIN
 * Automatically views/reads all WhatsApp statuses
 */

const config = require('../config');

async function handleStatusUpdate(sock, msg) {
  if (!config.AUTO_STATUS_VIEW) return;
  if (msg.key.remoteJid !== 'status@broadcast') return;

  try {
    // Mark status as read
    await sock.readMessages([msg.key]);
  } catch (err) {
    // Silently ignore errors
  }
}

module.exports = { handleStatusUpdate };
