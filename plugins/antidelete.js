/**
 * ANTI-DELETE — stores messages and re-sends deleted ones
 * Based on MEGA-MD's antidelete.js
 *
 * Key improvements:
 *  - Uses downloadContentFromMessage (stream-based, Baileys 7.x reliable)
 *  - handleRevoke() catches deletions from messages.upsert (Baileys 7.x primary path)
 *    protocolMessage.type 0 = REVOKE — this is what MEGA-MD uses
 *  - handleDelete() still covers messages.update as a backup
 *  - Temp dir with auto-cleanup when > 200 MB
 *
 * Toggle: .antidelete on | .antidelete off
 */

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { isOwner, reply, jidToNumber, getMessageText, getMessageType } from '../lib/utils.js';

const store = new Map(); // id → { msg, chat, sender, timestamp }
const MAX   = 2000;

// ── Temp dir for media ─────────────────────────────────────────────────────────
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

setInterval(() => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const totalBytes = files.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(TEMP_DIR, f)).size; } catch { return sum; }
    }, 0);
    if (totalBytes > 200 * 1024 * 1024) {
      files.forEach(f => { try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch {} });
    }
  } catch {}
}, 60_000);

let enabled = config.ANTI_DELETE;

// ── Store incoming messages ────────────────────────────────────────────────────
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

// ── Stream-based media download (MEGA-MD approach) ────────────────────────────
async function downloadMedia(mediaMsg, mediaType, msgId) {
  try {
    const stream = await downloadContentFromMessage(mediaMsg, mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const ext = { image: 'jpg', video: 'mp4', audio: 'mp3', document: 'bin', sticker: 'webp' }[mediaType] || 'bin';
    const tmpPath = path.join(TEMP_DIR, `del_${msgId}.${ext}`);
    fs.writeFileSync(tmpPath, buffer);
    return { buffer, tmpPath };
  } catch {
    return null;
  }
}

// ── Build and send the alert for a stored message ─────────────────────────────
async function sendDeleteAlert(sock, stored) {
  const { msg, chat, sender, timestamp } = stored;
  const text    = getMessageText(msg);
  const type    = getMessageType(msg);
  const caption =
    `🔴 *Anti-Delete Alert*\n` +
    `👤 Deleted by: ${jidToNumber(sender)}\n` +
    `💬 Chat: ${jidToNumber(chat)}\n` +
    `📅 Time: ${new Date(timestamp).toLocaleString()}\n` +
    (text ? `\n📝 *Message:*\n${text}` : '');

  const dest = config.ANTI_DELETE_SEND_TO === 'same_chat'
    ? chat
    : `${config.OWNER_NUMBER}@s.whatsapp.net`;

  const MEDIA_MAP = {
    imageMessage:    'image',
    videoMessage:    'video',
    audioMessage:    'audio',
    documentMessage: 'document',
    stickerMessage:  'sticker',
  };

  if (MEDIA_MAP[type]) {
    const mediaType = MEDIA_MAP[type];
    const result = await downloadMedia(msg.message[type], mediaType, msg.key.id);
    if (result) {
      try {
        await sock.sendMessage(dest, {
          [mediaType === 'document' ? 'document' : mediaType]: result.buffer,
          caption,
          mimetype: msg.message[type]?.mimetype,
        });
      } finally {
        try { fs.unlinkSync(result.tmpPath); } catch {}
      }
      return;
    }
  }

  if (caption) await sock.sendMessage(dest, { text: caption });
}

// ── Called from messages.upsert — Baileys 7.x PRIMARY deletion path ───────────
// When a message is deleted, Baileys 7.x delivers a protocolMessage with type 0
// (REVOKE) inside messages.upsert — this is MEGA-MD's detection approach.
export async function handleRevoke(sock, msg) {
  if (!enabled) return;
  const proto = msg.message?.protocolMessage;
  if (!proto || proto.type !== 0) return;

  const originalId = proto.key?.id;
  if (!originalId) return;

  const stored = store.get(originalId);
  if (!stored) return;

  try {
    await sendDeleteAlert(sock, stored);
    store.delete(originalId);
  } catch (err) {
    console.error('[anti-delete revoke]', err.message);
  }
}

// ── Called from messages.update — backup path ─────────────────────────────────
export async function handleDelete(sock, update) {
  if (!enabled) return;
  const { key, update: upd } = update;
  if (!key || !upd) return;

  const isRevoke =
    upd.messageStubType === 1 ||
    upd.message === null ||
    upd.message?.protocolMessage?.type === 0;

  if (!isRevoke) return;

  const stored = store.get(key.id);
  if (!stored) return;

  try {
    await sendDeleteAlert(sock, stored);
    store.delete(key.id);
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

export default { storeMessage, handleDelete, handleRevoke };
