/**
 * ANTI VIEW-ONCE — saves view-once media and lets owner reveal it with .vv
 */

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { isOwner, reply } from '../lib/utils.js';

const voStore = new Map(); // chat_jid → msg

export function storeViewOnce(msg) {
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
    const buffer = await downloadMediaMessage(stored, 'buffer', {}, {
      logger: pino({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });

    const m      = stored.message;
    const voKey  = Object.keys(m).find(k => m[k]?.viewOnce);
    const type   = voKey?.replace('Message', '') || 'image';

    await sock.sendMessage(jid, {
      [type]: buffer,
      caption: '👁️ *View-once media revealed by bot*',
    });
    voStore.delete(jid);
  } catch (err) {
    await reply(sock, msg, `❌ Could not reveal media: ${err.message}`);
  }
  return true;
}
