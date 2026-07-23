/**
 * ANTI-EDIT — captures original message before it is edited
 * Toggle: .antiedit on | .antiedit off
 */

import config from '../config.js';
import { isOwner, reply, getMessageText, jidToNumber } from '../lib/utils.js';

const store = new Map(); // id → { text, chat, sender, timestamp }
const MAX   = 2000;

// Runtime toggle (starts from env config)
let enabled = config.ANTI_EDIT;

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

// ── Shared alert sender ────────────────────────────────────────────────────────
async function sendEditAlert(sock, stored) {
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

// ── Called from messages.update (older Baileys path) ──────────────────────────
export async function handleEdit(sock, update) {
  if (!enabled) return;

  const { key, update: upd } = update;
  if (!upd?.message?.editedMessage && !upd?.message?.protocolMessage?.editedMessage) return;

  const stored = store.get(key.id);
  if (!stored) return;
  await sendEditAlert(sock, stored);
}

// ── Called from messages.upsert (Baileys 7.x primary edit path) ───────────────
// In Baileys 7.x, edits arrive as a protocolMessage (type 14 = MESSAGE_EDIT)
// inside messages.upsert, containing the original message key.
export async function handleEditUpsert(sock, msg) {
  if (!enabled) return;

  const proto = msg.message?.protocolMessage;
  // type 14 = MESSAGE_EDIT in the WhatsApp protocol
  if (!proto || proto.type !== 14) return;

  const originalId = proto.key?.id;
  if (!originalId) return;

  const stored = store.get(originalId);
  if (!stored) return;
  await sendEditAlert(sock, stored);
}

// ── Toggle command ─────────────────────────────────────────────────────────────
export async function handleAntiEditCommand(sock, msg, parsed) {
  if (parsed?.command !== 'antiedit') return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const arg = parsed.args[0]?.toLowerCase();
  if (arg === 'on') {
    enabled = true;
    await reply(sock, msg, '✏️ *Anti-Edit ON* — original messages will be forwarded when edited.');
  } else if (arg === 'off') {
    enabled = false;
    await reply(sock, msg, '🔕 *Anti-Edit OFF.*');
  } else {
    await reply(sock, msg, `✏️ Anti-Edit is currently *${enabled ? 'ON' : 'OFF'}*.\nUse *.antiedit on* or *.antiedit off*`);
  }
  return true;
}

export default { storeMessage, handleEdit, handleEditUpsert };
