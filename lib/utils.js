const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

/**
 * Get the sender JID from a message
 */
function getSender(msg) {
  return msg.key.fromMe
    ? msg.key.remoteJid
    : msg.key.participant || msg.key.remoteJid;
}

/**
 * Get chat JID
 */
function getChat(msg) {
  return msg.key.remoteJid;
}

/**
 * Check if message is from owner
 */
function isOwner(msg) {
  const sender = getSender(msg);
  const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
  return sender === ownerJid || msg.key.fromMe;
}

/**
 * Check if chat is a group
 */
function isGroup(msg) {
  return msg.key.remoteJid.endsWith('@g.us');
}

/**
 * Check if chat is a DM
 */
function isDM(msg) {
  return msg.key.remoteJid.endsWith('@s.whatsapp.net');
}

/**
 * Extract text from a message
 */
function getMessageText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  );
}

/**
 * Parse command and args from message text
 */
function parseCommand(text, prefix) {
  if (!text.startsWith(prefix)) return null;
  const parts = text.slice(prefix.length).trim().split(/\s+/);
  return {
    command: parts[0].toLowerCase(),
    args: parts.slice(1),
    body: parts.slice(1).join(' '),
  };
}

/**
 * Download media from a message
 */
async function downloadMedia(sock, msg) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
      logger: require('pino')({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });
    return buffer;
  } catch (err) {
    return null;
  }
}

/**
 * Get message type string
 */
function getMessageType(msg) {
  if (!msg.message) return null;
  const keys = Object.keys(msg.message);
  return keys.find(k => k !== 'messageContextInfo') || null;
}

/**
 * Format a JID to a readable phone number
 */
function jidToNumber(jid) {
  return jid.replace(/@.+/, '');
}

/**
 * Delay helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely reply to a message
 */
async function reply(sock, msg, text, options = {}) {
  const jid = msg.key.remoteJid;
  try {
    return await sock.sendMessage(jid, { text, ...options }, { quoted: msg });
  } catch (err) {
    console.error('Reply error:', err.message);
  }
}

/**
 * Send a message to owner
 */
async function sendToOwner(sock, text, options = {}) {
  const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
  try {
    return await sock.sendMessage(ownerJid, { text, ...options });
  } catch (err) {
    console.error('SendToOwner error:', err.message);
  }
}

/**
 * React to a message with an emoji
 */
async function reactTo(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: emoji, key: msg.key },
    });
  } catch (_) {}
}

module.exports = {
  getSender,
  getChat,
  isOwner,
  isGroup,
  isDM,
  getMessageText,
  parseCommand,
  downloadMedia,
  getMessageType,
  jidToNumber,
  sleep,
  reply,
  sendToOwner,
  reactTo,
};
