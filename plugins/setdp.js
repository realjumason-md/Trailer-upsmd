/**
 * SET DP — update the bot's WhatsApp profile picture
 * Based on MEGA-MD's setpp.js
 *
 * Key improvements:
 *  - Uses downloadContentFromMessage (stream-based, Baileys 7.x reliable)
 *  - Writes to a temp file first, then passes { url: path } to updateProfilePicture
 *  - Accepts direct image, replied image, or sticker
 */

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { isOwner, reply } from '../lib/utils.js';

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

export async function handleSetDp(sock, msg, parsed) {
  if (parsed?.command !== 'setdp') return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const direct = msg.message?.imageMessage || msg.message?.stickerMessage;
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const imageMessage = direct || quoted?.imageMessage || quoted?.stickerMessage;

  if (!imageMessage) {
    await reply(sock, msg, '❌ Attach an image or reply to one with .setdp');
    return true;
  }

  const isSticker = !!(msg.message?.stickerMessage || quoted?.stickerMessage);
  const mediaType = isSticker ? 'sticker' : 'image';

  try {
    const stream = await downloadContentFromMessage(imageMessage, mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const tmpPath = path.join(TEMP_DIR, `dp_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, buffer);

    await sock.updateProfilePicture(sock.user.id, { url: tmpPath });
    try { fs.unlinkSync(tmpPath); } catch {}

    await reply(sock, msg, '✅ *Profile picture updated!*');
  } catch (err) {
    await reply(sock, msg, `❌ Failed: ${err.message}`);
  }
  return true;
}
