/**
 * ANTI-DELETE — stores messages and re-sends deleted ones
 */

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config.js';
import { sendToOwner, jidToNumber, getMessageType } from '../lib/utils.js';

const store   = new Map(); // id → { msg, chat, sender, timestamp }
const MAX     = 2000;

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
  if (!config.ANTI_DELETE) return;

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

export default { storeMessage, handleDelete };
