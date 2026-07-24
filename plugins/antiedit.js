/**
 * ANTI-EDIT — captures original message before it is edited, then sends the
 * original content when an edit is detected.
 *
 * Key fix: storeMessage() refuses to overwrite an existing entry.
 * This matters because in Baileys 7.x edits can arrive in messages.upsert
 * with the same key.id as the original — if we overwrote, we'd lose the
 * original content before we could send the alert.
 *
 * Toggle: .antiedit on | .antiedit off
 */

import config from '../config.js';
import { isOwner, reply, getMessageText, jidToNumber } from '../lib/utils.js';

const store = new Map(); // originalMsgId → { text, chat, sender, timestamp }
const MAX   = 2000;

// Runtime toggle (starts from env config)
let enabled = config.ANTI_EDIT;

export function storeMessage(msg) {
  if (!msg.message || !msg.key.id) return;

  // Skip protocol messages (edits, deletes, receipts) — they are not user content
  const firstKey = Object.keys(msg.message)[0];
  if (firstKey === 'protocolMessage' || firstKey === 'messageContextInfo') return;

  // IMPORTANT: never overwrite an existing entry.
  // If the same key.id arrives again (e.g. Baileys resending an edited message
  // with the original ID), we must keep the original content.
  if (store.has(msg.key.id)) return;

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
async function sendEditAlert(sock, stored, editedText) {
  const { text: originalText, chat, sender } = stored;

  let caption =
    `✏️ *Anti-Edit Alert*\n` +
    `👤 Edited by: @${jidToNumber(sender)}\n` +
    `💬 Chat: ${jidToNumber(chat)}\n` +
    `📅 Time: ${new Date(stored.timestamp).toLocaleString()}\n\n` +
    `📝 *Original message:*\n${originalText}`;

  if (editedText && editedText !== originalText) {
    caption += `\n\n✏️ *Edited to:*\n${editedText}`;
  }

  const dest = config.ANTI_DELETE_SEND_TO === 'same_chat'
    ? chat
    : `${config.OWNER_NUMBER}@s.whatsapp.net`;

  try {
    await sock.sendMessage(dest, {
      text: caption,
      mentions: [sender],
    });
  } catch (err) {
    console.error('[anti-edit]', err.message);
  }
}

// ── Called from messages.update (older Baileys path) ──────────────────────────
export async function handleEdit(sock, update) {
  if (!enabled) return;

  const { key, update: upd } = update;

  // Baileys may surface edits as editedMessage inside the update payload
  const editedMsg  = upd?.message?.editedMessage;
  const protoEdited = upd?.message?.protocolMessage?.editedMessage;
  if (!editedMsg && !protoEdited) return;

  const stored = store.get(key.id);
  if (!stored) return;

  // Try to extract the new text from the edit payload
  const newText =
    editedMsg?.message?.conversation ||
    editedMsg?.message?.extendedTextMessage?.text ||
    '';

  await sendEditAlert(sock, stored, newText);
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

  // Extract the new (edited) text from the protocolMessage payload
  const editedMsg = proto.editedMessage;
  const newText =
    editedMsg?.conversation ||
    editedMsg?.extendedTextMessage?.text ||
    '';

  await sendEditAlert(sock, stored, newText);
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
