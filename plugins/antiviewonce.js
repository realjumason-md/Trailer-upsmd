/**
 * ANTI VIEW-ONCE — saves view-once media and lets owner reveal it with .vv
 * Toggle: .antiviewonce on | .antiviewonce off
 */

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config.js';
import { isOwner, reply } from '../lib/utils.js';

// Runtime toggle (starts from env config)
let enabled = config.ANTI_VIEW_ONCE;

const voStore = new Map(); // chat_jid → msg

export function storeViewOnce(msg) {
  if (!enabled) return;
  const m = msg.message;
  if (!m) return;

  const voKey = Object.keys(m).find(k => {
    const inner = m[k];
    return inner?.viewOnce || inner?.message?.imageMessage?.viewOnce || inner?.message?.videoMessage?.viewOnce;
  });
  if (!voKey) return;

  voStore.set(msg.key.remoteJid, msg);
}

export async function handleVV(sock, msg, parsed) {
  if (parsed?.command !== 'vv') return false;
  if (!isOwner(msg)) {
    await reply(sock, msg, '❌ Only the bot owner can use this command.');
    return true;
  }

  const jid    = msg.key.remoteJid;
  const stored = voStore.get(jid);
  if (!stored) {
    await reply(sock, msg, '❌ No view-once media found for this chat.');
    return true;
  }

  try {
    const m = stored.message;

    // Locate the view-once wrapper key (viewOnceMessage, viewOnceMessageV2, etc.)
    const voKey = Object.keys(m).find(k =>
      m[k]?.viewOnce ||
      m[k]?.message?.imageMessage?.viewOnce ||
      m[k]?.message?.videoMessage?.viewOnce
    );

    // Extract actual media type from inside the wrapper
    let mediaType = 'image';
    if (voKey) {
      const inner = m[voKey];
      if (inner?.message?.videoMessage || inner?.videoMessage) mediaType = 'video';
      else if (inner?.message?.imageMessage || inner?.imageMessage) mediaType = 'image';
    } else {
      // Fallback: direct imageMessage / videoMessage (older Baileys format)
      if (m.videoMessage) mediaType = 'video';
    }

    // Build a downloadable message — Baileys needs a proper WAMessage shape
    let downloadTarget = stored;
    if (voKey && m[voKey]?.message) {
      // Unwrap the view-once envelope so downloadMediaMessage can locate the keys
      downloadTarget = {
        ...stored,
        message: m[voKey].message,
      };
    }

    const buffer = await downloadMediaMessage(downloadTarget, 'buffer', {}, {
      logger: pino({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });

    await sock.sendMessage(jid, {
      [mediaType]: buffer,
      caption: '👁️ *View-once media revealed by bot*',
    });
    voStore.delete(jid);
  } catch (err) {
    await reply(sock, msg, `❌ Could not reveal media: ${err.message}`);
  }
  return true;
}

// ── Toggle command ─────────────────────────────────────────────────────────────
export async function handleAntiViewOnceCommand(sock, msg, parsed) {
  if (parsed?.command !== 'antiviewonce') return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const arg = parsed.args[0]?.toLowerCase();
  if (arg === 'on') {
    enabled = true;
    await reply(sock, msg, '👁️ *Anti View-Once ON* — view-once media will be saved. Use .vv to reveal.');
  } else if (arg === 'off') {
    enabled = false;
    voStore.clear();
    await reply(sock, msg, '🔕 *Anti View-Once OFF.*');
  } else {
    await reply(sock, msg, `👁️ Anti View-Once is currently *${enabled ? 'ON' : 'OFF'}*.\nUse *.antiviewonce on* or *.antiviewonce off*`);
  }
  return true;
}
