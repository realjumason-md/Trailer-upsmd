/**
 * ANTI-DELETE — stores messages and re-sends deleted ones
 * Toggle: .antidelete on | .antidelete off
 */

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config.js';
import { isOwner, reply, sendToOwner, jidToNumber, getMessageText, getMessageType } from '../lib/utils.js';

const store = new Map(); // id → { msg, chat, sender, timestamp }
const MAX   = 2000;

// Runtime toggle (starts from env config)
let enabled = config.ANTI_DELETE;

export function storeMessage(msg) {
  if (!msg.message || !msg.key.id) return;
  const type = Object.keys(msg.message)[0];
  if (type === 'protocolMessage' || type === 'messageContextInfo') return;

  if (store.size >= MAX) store.delete(store.keys().next().value);

  store.set(msg.key.id, {
    msg:       JSON.parse(JSON.stringify(msg)),
    chat:      msg.key.remoteJid,
    sender:    msg.key.participant || msg.key.remoteJid,
    timestamp: Date.now(),
  });
}

export async function handleDelete(sock, update) {
  if (!enabled) return;

  const { key, update: upd } = update;
  if (!key || !upd?.messageStubType) return;

  // messageStubType 1 = revoke
  const isRevoke =
    upd.messageStubType === 1 ||
    (upd.message?.protocolMessage?.type === 0);

  if (!isRevoke) return;

  const id      = key.id;
  const stored  = store.get(id);
  if (!stored) return;

  const { msg, chat, sender } = stored;
  const text    = getMessageText(msg);
  const type    = getMessageType(msg);
  const deleted_by = sender === msg.key.fromMe ? 'You (bot)' : jidToNumber(sender);
  const in_chat    = jidToNumber(chat);

  const caption =
    `🔴 *Anti-Delete Alert*\n` +
    `👤 Deleted by: ${deleted_by}\n` +
    `💬 Chat: ${in_chat}\n` +
    `📅 Time: ${new Date(stored.timestamp).toLocaleString()}\n` +
    (text ? `\n📝 *Message:*\n${text}` : '');

  const dest = config.ANTI_DELETE_SEND_TO === 'same_chat'
    ? chat
    : `${config.OWNER_NUMBER}@s.whatsapp.net`;

  try {
    if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(type)) {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
        logger: pino({ level: 'silent' }),
        reuploadRequest: sock.updateMediaMessage,
      }).catch(() => null);

      if (buffer) {
        const mediaType = type.replace('Message', '');
        await sock.sendMessage(dest, { [mediaType]: buffer, caption });
        return;
      }
    }
    if (caption) await sock.sendMessage(dest, { text: caption });
  } catch (err) {
    console.error('[anti-delete]', err.message);
  }
}

// ── Toggle command ─────────────────────────────────────────────────────────────
export async function handleAntiDeleteCommand(sock, msg, parsed) {
  if (parsed?.command !== 'antidelete') return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const arg = parsed.args[0]?.toLowerCase();
  if (arg === 'on') {
    enabled = true;
    await reply(sock, msg, '🛡️ *Anti-Delete ON* — deleted messages will be forwarded.');
  } else if (arg === 'off') {
    enabled = false;
    await reply(sock, msg, '🔕 *Anti-Delete OFF.*');
  } else {
    await reply(sock, msg, `🛡️ Anti-Delete is currently *${enabled ? 'ON' : 'OFF'}*.\nUse *.antidelete on* or *.antidelete off*`);
  }
  return true;
}

export default { storeMessage, handleDelete };
