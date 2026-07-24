/**
 * ANTI VIEW-ONCE — saves view-once media and lets owner reveal it with .vv
 * Based on MEGA-MD's viewonce.js
 *
 * Key improvements:
 *  - Uses downloadContentFromMessage (stream-based, Baileys 7.x reliable)
 *  - .vv works as a direct reply to a view-once message (MEGA-MD approach)
 *  - Falls back to auto-stored view-once if not replying directly
 *
 * Toggle: .antiviewonce on | .antiviewonce off
 */

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import config from '../config.js';
import { isOwner, reply } from '../lib/utils.js';

let enabled = config.ANTI_VIEW_ONCE;
const voStore = new Map(); // chat_jid → msg

export function storeViewOnce(msg) {
  if (!enabled) return;
  const m = msg.message;
  if (!m) return;

  const voKey = Object.keys(m).find(k => {
    const inner = m[k];
    return inner?.viewOnce ||
      inner?.message?.imageMessage?.viewOnce ||
      inner?.message?.videoMessage?.viewOnce;
  });
  if (!voKey) return;

  voStore.set(msg.key.remoteJid, msg);
}

async function streamToBuffer(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function handleVV(sock, msg, parsed) {
  if (parsed?.command !== 'vv') return false;
  if (!isOwner(msg)) {
    await reply(sock, msg, '❌ Only the bot owner can use this command.');
    return true;
  }

  const jid = msg.key.remoteJid;

  // Method 1: direct reply to a view-once message (MEGA-MD approach)
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (quoted) {
    const img = quoted.imageMessage;
    const vid = quoted.videoMessage;

    if (img?.viewOnce) {
      try {
        const buffer = await streamToBuffer(img, 'image');
        await sock.sendMessage(jid, { image: buffer, caption: '👁️ *View-once revealed*' }, { quoted: msg });
      } catch (err) {
        await reply(sock, msg, `❌ Could not reveal: ${err.message}`);
      }
      return true;
    }
    if (vid?.viewOnce) {
      try {
        const buffer = await streamToBuffer(vid, 'video');
        await sock.sendMessage(jid, { video: buffer, caption: '👁️ *View-once revealed*' }, { quoted: msg });
      } catch (err) {
        await reply(sock, msg, `❌ Could not reveal: ${err.message}`);
      }
      return true;
    }
  }

  // Method 2: use auto-stored view-once
  const stored = voStore.get(jid);
  if (!stored) {
    await reply(sock, msg,
      '❌ No view-once media found.\n\n' +
      '_Reply directly to the view-once message with .vv, or ensure .antiviewonce is ON._'
    );
    return true;
  }

  try {
    const m = stored.message;

    const voKey = Object.keys(m).find(k =>
      m[k]?.viewOnce ||
      m[k]?.message?.imageMessage?.viewOnce ||
      m[k]?.message?.videoMessage?.viewOnce
    );

    let mediaType = 'image';
    let mediaMsg  = null;

    if (voKey) {
      const inner = m[voKey];
      if (inner?.message?.videoMessage)      { mediaType = 'video'; mediaMsg = inner.message.videoMessage; }
      else if (inner?.message?.imageMessage) { mediaType = 'image'; mediaMsg = inner.message.imageMessage; }
      else if (inner?.videoMessage)          { mediaType = 'video'; mediaMsg = inner.videoMessage; }
      else if (inner?.imageMessage)          { mediaType = 'image'; mediaMsg = inner.imageMessage; }
    } else {
      if (m.videoMessage)      { mediaType = 'video'; mediaMsg = m.videoMessage; }
      else if (m.imageMessage) { mediaType = 'image'; mediaMsg = m.imageMessage; }
    }

    if (!mediaMsg) {
      await reply(sock, msg, '❌ Could not locate media in stored view-once.');
      return true;
    }

    const buffer = await streamToBuffer(mediaMsg, mediaType);
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
    await reply(sock, msg,
      `👁️ Anti View-Once: *${enabled ? 'ON' : 'OFF'}*\n` +
      `Use *.antiviewonce on* or *.antiviewonce off*\n\n` +
      `_Tip: Reply directly to a view-once with *.vv* to reveal it instantly._`
    );
  }
  return true;
}
