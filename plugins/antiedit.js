/**
 * ANTI-EDIT PLUGIN
 * Detects edited messages and shows the original content to the owner
 */

const config = require('../config');
const { jidToNumber } = require('../lib/utils');

// Store original messages { messageId -> { text, chat, sender, timestamp } }
const originalStore = new Map();
const MAX_STORE = 2000;

function storeOriginal(msg) {
  if (!msg.message || !msg.key.id) return;
  const type = Object.keys(msg.message)[0];
  if (type === 'protocolMessage' || type === 'messageContextInfo') return;

  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    null;

  if (!text) return; // Only track text-based messages for edit detection

  if (originalStore.size >= MAX_STORE) {
    const firstKey = originalStore.keys().next().value;
    originalStore.delete(firstKey);
  }

  originalStore.set(msg.key.id, {
    text,
    chat: msg.key.remoteJid,
    sender: msg.key.participant || msg.key.remoteJid,
    timestamp: Date.now(),
  });
}

async function handleEdit(sock, editMsg) {
  if (!config.ANTI_EDIT) return;

  // Edited messages come as editedMessage inside protocolMessage
  const proto = editMsg.message?.protocolMessage;
  if (!proto || proto.type !== 14) return; // type 14 = MESSAGE_EDIT

  const originalId = proto.key?.id;
  if (!originalId) return;

  const stored = originalStore.get(originalId);
  if (!stored) return;

  const { text: originalText, chat, sender } = stored;
  const senderNum = jidToNumber(sender);
  const chatNum = jidToNumber(chat);
  const isGroup = chat.endsWith('@g.us');

  // Get new edited text
  const newText =
    proto.editedMessage?.conversation ||
    proto.editedMessage?.extendedTextMessage?.text ||
    '[new content not available]';

  const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
  const targetJid = config.ANTI_DELETE_SEND_TO === 'owner' ? ownerJid : chat;

  const alertText =
    `╔══════════════════════╗\n` +
    `║  ✏️  EDITED MESSAGE    ║\n` +
    `╚══════════════════════╝\n\n` +
    `👤 *Sender:* +${senderNum}\n` +
    `💬 *Chat:* ${isGroup ? `Group (${chatNum})` : `DM`}\n` +
    `🕐 *Time:* ${new Date().toLocaleString()}\n` +
    `─────────────────────────\n` +
    `📝 *Original:*\n${originalText}\n\n` +
    `✏️ *Edited to:*\n${newText}`;

  try {
    await sock.sendMessage(targetJid, { text: alertText });
    // Update stored text to the new version
    originalStore.set(originalId, { ...stored, text: newText, timestamp: Date.now() });
  } catch (err) {
    console.error('[AntiEdit] Error:', err.message);
  }
}

module.exports = { storeOriginal, handleEdit };
