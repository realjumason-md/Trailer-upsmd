/**
 * AUTO STATUS VIEW — automatically views WhatsApp status updates
 * Toggle: .autostatus on | .autostatus off
 */

import config from '../config.js';
import { isOwner, reply } from '../lib/utils.js';

// Runtime toggle (starts from env config)
let enabled = config.AUTO_STATUS_VIEW;

export async function handle(sock, msg) {
  if (!enabled) return;
  try {
    if (msg.key?.remoteJid !== 'status@broadcast') return;
    await sock.readMessages([msg.key]);
  } catch (err) {
    console.error('[autostatus]', err.message);
  }
}

// ── Toggle command ─────────────────────────────────────────────────────────────
export async function handleAutoStatusCommand(sock, msg, parsed) {
  if (parsed?.command !== 'autostatus') return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const arg = parsed.args[0]?.toLowerCase();
  if (arg === 'on') {
    enabled = true;
    await reply(sock, msg, '👁️ *Auto Status View ON* — statuses will be viewed automatically.');
  } else if (arg === 'off') {
    enabled = false;
    await reply(sock, msg, '🔕 *Auto Status View OFF.*');
  } else {
    await reply(sock, msg, `👁️ Auto Status View is currently *${enabled ? 'ON' : 'OFF'}*.\nUse *.autostatus on* or *.autostatus off*`);
  }
  return true;
}

export default { handle };
