/**
 * SHARED UTILITIES
 */

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import config from '../config.js';

// ── Sender / chat helpers ──────────────────────────────────────────────────────

export function getSender(msg) {
  return msg.key.fromMe
    ? msg.key.remoteJid
    : msg.key.participant || msg.key.remoteJid;
}

export function getChat(msg) {
  return msg.key.remoteJid;
}

export function isOwner(msg) {
  const sender   = getSender(msg);
  const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
  return sender === ownerJid || msg.key.fromMe;
}

export function isGroup(msg) {
  return msg.key.remoteJid?.endsWith('@g.us');
}

export function isDM(msg) {
  return msg.key.remoteJid?.endsWith('@s.whatsapp.net');
}

// ── Text extraction ────────────────────────────────────────────────────────────

export function getMessageText(msg) {
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

// ── Command parser ─────────────────────────────────────────────────────────────

export function parseCommand(text, prefix) {
  if (!text.startsWith(prefix)) return null;
  const parts = text.slice(prefix.length).trim().split(/\s+/);
  return {
    command: parts[0].toLowerCase(),
    args:    parts.slice(1),
    body:    parts.slice(1).join(' '),
  };
}

// ── Media download ─────────────────────────────────────────────────────────────

export async function downloadMedia(sock, msg) {
  try {
    return await downloadMediaMessage(msg, 'buffer', {}, {
      logger: pino({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });
  } catch {
    return null;
  }
}

// ── Message type ───────────────────────────────────────────────────────────────

export function getMessageType(msg) {
  if (!msg.message) return null;
  return Object.keys(msg.message).find(k => k !== 'messageContextInfo') || null;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

export function jidToNumber(jid) {
  return jid.replace(/@.+/, '').split(':')[0];
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Send helpers ───────────────────────────────────────────────────────────────

export async function reply(sock, msg, text, options = {}) {
  const jid = msg.key.remoteJid;
  try {
    return await sock.sendMessage(jid, { text, ...options }, { quoted: msg });
  } catch (err) {
    console.error('[reply]', err.message);
  }
}

export async function sendToOwner(sock, text, options = {}) {
  const ownerJid = `${config.OWNER_NUMBER}@s.whatsapp.net`;
  try {
    return await sock.sendMessage(ownerJid, { text, ...options });
  } catch (err) {
    console.error('[sendToOwner]', err.message);
  }
}

export async function reactTo(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
  } catch (_) {}
}
