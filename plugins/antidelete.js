/**
 * ANTI-DELETE PLUGIN
 * Detects deleted messages and forwards the original to the owner (or same chat)
 */

const config = require('../config');
const { sendToOwner, jidToNumber, getMessageType } = require('../lib/utils');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// In-memory store: { messageId -> { msg, chat, sender, timestamp } }
const messageStore = new Map();
const MAX_STORE = 2000; // keep last 2000 messages

function storeMessage(msg) {
  if (!msg.message || !msg.key.id) return;
  // Don't store protocol/stub messages
  const type = Object.keys(msg.message)[0];
  if (type === 'protocolMessage' || type === 'messageContextInfo') return;

  // Evict oldest when full
  if (messageStore.size >= MAX_STORE) {
    const firstKey = messageStore.keys().next().value;
    messageStore.delete(firstKey);
  }

  messageStore.set(msg.key.id, {
    msg: JSON.parse(JSON.stringify(msg)),
    chat: msg.key.remoteJid,
    sender: msg.key.participant || msg.key.remoteJid,
    timestamp: Date.now(),
  });
}

async function handleDelete(sock, deletedMsg) {
  if (!config.ANTI_DELETE) return;

  const { id } = deletedMsg.key || {};
  if (!id) return;

  const stored = messageStore.get(id);
  if (!stored) return;

  const { msg, chat, sender } = stored;
  const senderNum = jidToNumber(sender);
  const chatNum = jidToNumber(chat);
  const isGroup = chat.endsWith('@g.us');

  const header =
    `╔══════════════════════╗\n` +
    `║  🗑️  DELETED MESSAGE   ║\n` +
    `╚══════════════════════╝\n\n` +
    `👤 *Sender:* +${senderNum}\n` +
    `💬 *Chat:* ${isGroup ? `Group (${chatNum})` : `DM`}\n` +
    `🕐 *Time:* ${new Date().toLocaleString()}\n` +
    `─────────────────────────\n`;

  const targetJid =
    config.ANTI_DELETE_SEND_TO === 'owner'
      ? `${config.OWNER_NUMBER}@s.whatsapp.net`
      : chat;

  try {
    const type = getMessageType(msg);

    if (!type || type === 'conversation' || type === 'extendedTextMessage') {
      // Text message
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '[no text]';
      await sock.sendMessage(targetJid, {
        text: header + `📝 *Message:*\n${text}`,
      });
    } else if (type === 'imageMessage') {
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
          logger: require('pino')({ level: 'silent' }),
          reuploadRequest: sock.updateMediaMessage,
        });
        const caption =
          header + (msg.message.imageMessage?.caption ? `\n📝 ${msg.message.imageMessage.caption}` : '');
        await sock.sendMessage(targetJid, {
          image: buffer,
          caption,
        });
      } catch {
        await sock.sendMessage(targetJid, { text: header + '🖼️ [Image — could not download]' });
      }
    } else if (type === 'videoMessage') {
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
          logger: require('pino')({ level: 'silent' }),
          reuploadRequest: sock.updateMediaMessage,
        });
        const caption =
          header + (msg.message.videoMessage?.caption ? `\n📝 ${msg.message.videoMessage.caption}` : '');
        await sock.sendMessage(targetJid, {
          video: buffer,
          caption,
        });
      } catch {
        await sock.sendMessage(targetJid, { text: header + '🎥 [Video — could not download]' });
      }
    } else if (type === 'audioMessage' || type === 'pttMessage') {
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
          logger: require('pino')({ level: 'silent' }),
          reuploadRequest: sock.updateMediaMessage,
        });
        await sock.sendMessage(targetJid, {
          audio: buffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: type === 'pttMessage',
        });
        await sock.sendMessage(targetJid, { text: header + '🎵 [Voice/Audio deleted]' });
      } catch {
        await sock.sendMessage(targetJid, { text: header + '🎵 [Audio — could not download]' });
      }
    } else if (type === 'stickerMessage') {
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
          logger: require('pino')({ level: 'silent' }),
          reuploadRequest: sock.updateMediaMessage,
        });
        await sock.sendMessage(targetJid, { sticker: buffer });
        await sock.sendMessage(targetJid, { text: header + '🎭 [Sticker deleted]' });
      } catch {
        await sock.sendMessage(targetJid, { text: header + '🎭 [Sticker — could not download]' });
      }
    } else if (type === 'documentMessage') {
      await sock.sendMessage(targetJid, {
        text: header + `📄 [Document deleted: ${msg.message.documentMessage?.fileName || 'unknown'}]`,
      });
    } else {
      await sock.sendMessage(targetJid, {
        text: header + `📦 [Deleted message type: ${type}]`,
      });
    }

    messageStore.delete(id);
  } catch (err) {
    console.error('[AntiDelete] Error forwarding deleted message:', err.message);
  }
}

module.exports = { storeMessage, handleDelete };
