/**
 * AUTO STATUS VIEW — automatically views and optionally reacts to WhatsApp statuses
 * Based on MEGA-MD's autostatus.js
 *
 * Key improvements:
 *  - Optional 💚 reaction to every status (.autostatus react on/off)
 *  - Rate-limit aware (silently skips rate-overlimit errors)
 *
 * Toggle: .autostatus on | .autostatus off
 * Reactions: .autostatus react on | .autostatus react off
 */

import config from '../config.js';
import { isOwner, reply } from '../lib/utils.js';

let enabled = config.AUTO_STATUS_VIEW;
let reactOn  = false;

export async function handle(sock, msg) {
  if (!enabled) return;
  try {
    if (msg.key?.remoteJid !== 'status@broadcast') return;

    await new Promise(r => setTimeout(r, 1000));
    await sock.readMessages([msg.key]);

    if (reactOn) {
      try {
        await sock.relayMessage('status@broadcast', {
          reactionMessage: {
            key: {
              remoteJid:   'status@broadcast',
              id:          msg.key.id,
              participant: msg.key.participant || msg.key.remoteJid,
              fromMe:      false,
            },
            text: '💚',
          },
        }, {
          messageId:     msg.key.id,
          statusJidList: [msg.key.remoteJid, msg.key.participant || msg.key.remoteJid].filter(Boolean),
        });
      } catch (err) {
        if (!err.message?.includes('rate-overlimit')) {
          console.error('[autostatus react]', err.message);
        }
      }
    }
  } catch (err) {
    if (!err.message?.includes('rate-overlimit')) {
      console.error('[autostatus]', err.message);
    }
  }
}

export async function handleAutoStatusCommand(sock, msg, parsed) {
  if (parsed?.command !== 'autostatus') return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const arg  = parsed.args[0]?.toLowerCase();
  const arg2 = parsed.args[1]?.toLowerCase();

  if (arg === 'react') {
    if (arg2 === 'on') {
      reactOn = true;
      await reply(sock, msg, '💚 *Status reactions ON* — bot will react 💚 to every status.');
    } else if (arg2 === 'off') {
      reactOn = false;
      await reply(sock, msg, '🔕 *Status reactions OFF.*');
    } else {
      await reply(sock, msg,
        `💚 Status reactions: *${reactOn ? 'ON' : 'OFF'}*\n` +
        `Use *.autostatus react on* or *.autostatus react off*`
      );
    }
    return true;
  }

  if (arg === 'on') {
    enabled = true;
    await reply(sock, msg,
      '👁️ *Auto Status View ON* — statuses will be viewed automatically.\n\n' +
      '_Tip: Use .autostatus react on to also react 💚 to every status._'
    );
  } else if (arg === 'off') {
    enabled = false;
    await reply(sock, msg, '🔕 *Auto Status View OFF.*');
  } else {
    await reply(sock, msg,
      `👁️ Auto Status View: *${enabled ? 'ON' : 'OFF'}*\n` +
      `💚 React to statuses: *${reactOn ? 'ON' : 'OFF'}*\n\n` +
      `*.autostatus on/off* — toggle view\n` +
      `*.autostatus react on/off* — toggle 💚 reactions`
    );
  }
  return true;
}

export default { handle };
