/**
 * SET DP PLUGIN
 * .setdp — sets your WhatsApp profile picture
 * Usage: Send .setdp with an image attached, or reply to an image with .setdp
 */

const config = require('../config');
const { isOwner, reply, downloadMedia, getMessageType } = require('../lib/utils');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

async function handleSetDp(sock, msg, { command }) {
  if (command !== 'setdp') return;
  if (!isOwner(msg)) return reply(sock, msg, '❌ Only the bot owner can use this command.');

  let imgBuffer = null;
  const type = getMessageType(msg);
  const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  // Check if image is attached to this message
  if (type === 'imageMessage') {
    imgBuffer = await downloadMedia(sock, msg);
  }
  // Check if replying to an image
  else if (quotedMsg) {
    const quotedType = Object.keys(quotedMsg)[0];
    if (quotedType === 'imageMessage') {
      const fakeMsg = {
        key: msg.message.extendedTextMessage?.contextInfo?.stanzaId
          ? { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId }
          : msg.key,
        message: quotedMsg,
      };
      try {
        imgBuffer = await downloadMediaMessage(fakeMsg, 'buffer', {}, {
          logger: require('pino')({ level: 'silent' }),
          reuploadRequest: sock.updateMediaMessage,
        });
      } catch {
        imgBuffer = null;
      }
    }
  }

  if (!imgBuffer) {
    return reply(sock, msg, '❌ Please attach an image or reply to an image with .setdp');
  }

  try {
    await sock.updateProfilePicture(sock.user.id, imgBuffer);
    return reply(sock, msg, '✅ Profile picture updated successfully! 🖼️');
  } catch (err) {
    return reply(sock, msg, `❌ Failed to update profile picture: ${err.message}`);
  }
}

module.exports = { handleSetDp };
