/**
 * ANTI-EDIT — captures original message before it is edited
 */

import config from '../config.js';
import { getMessageText, jidToNumber } from '../lib/utils.js';

const store = new Map(); // id → { text, chat, sender, timestamp }
const MAX   = 2000;

export function storeMessage(msg) {
  if (!msg.message || !msg.key.id) return;
  const text = getMessageText(msg);
  if (!text) return;

  if (store.size >= MAX) store.delete(store.keys().next().value);

  store.set(msg.key.id, {
    text,
    chat:      msg.key.remoteJid,
    sender:    msg.key.participant || msg.key.remoteJid,
    timestamp: Date.now(),
  });
}

export async function handleEdit(sock, update) {
  if (!config.ANTI_EDIT) return;

  const { key, update: upd } = update;
  if (!upd?.message?.editedMessage && !upd?.message?.protocolMessage?.editedMessage) return;

  const id     = key.id;
  const stored = store.get(id);
  if (!stored) return;

  const { text, chat, sender } = stored;

  const caption =
    `✏️ *Anti-Edit Alert*\n` +
    `👤 Edited by: ${jidToNumber(sender)}\n` +
    `💬 Chat: ${jidToNumber(chat)}\n` +
    `📅 Time: ${new Date(stored.timestamp).toLocaleString()}\n\n` +
    `📝 *Original message:*\n${text}`;

  const dest = config.ANTI_DELETE_SEND_TO === 'same_chat'
    ? chat
    : `${config.OWNER_NUMBER}@s.whatsapp.net`;

  try {
    await sock.sendMessage(dest, { text: caption });
  } catch (err) {
    console.error('[anti-edit]', err.message);
  }
}

export default { storeMessage, handleEdit };
