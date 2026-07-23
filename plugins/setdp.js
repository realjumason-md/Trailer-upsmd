/**
 * SET DP — update the bot's WhatsApp profile picture
 */

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { isOwner, reply } from '../lib/utils.js';

export async function handleSetDp(sock, msg, parsed) {
  if (parsed?.command !== 'setdp') return false;
  if (!isOwner(msg)) {
    await reply(sock, msg, '🔒 Owner only.');
    return true;
  }

  // Accept: message with image attached, or a reply to an image
  const target = msg.message?.imageMessage
    ? msg
    : msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
      ? { message: { imageMessage: msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage }, key: { remoteJid: msg.key.remoteJid, fromMe: false, id: msg.message.extendedTextMessage.contextInfo.stanzaId } }
      : null;

  if (!target) {
    await reply(sock, msg, '❌ Attach an image or reply to one with .setdp');
    return true;
  }

  try {
    const buffer = await downloadMediaMessage(target, 'buffer', {}, {
      logger: pino({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });
    await sock.updateProfilePicture(sock.user.id, buffer);
    await reply(sock, msg, '✅ Profile picture updated!');
  } catch (err) {
    await reply(sock, msg, `❌ Failed: ${err.message}`);
  }
  return true;
}
