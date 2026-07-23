/**
 * GET DP / PROFILE PICTURE PLUGIN
 * .getdp / .getpp — sends you the profile picture of the current chat or a mentioned contact
 *
 * Usage:
 *   .getdp           — get profile pic of the current chat / contact
 *   .getdp @mention  — get profile pic of a mentioned person
 *   .getdp 2567xxxx  — get profile pic by phone number
 */

const { isOwner, reply, reactTo } = require('../lib/utils');
const config = require('../config');

async function handleGetDp(sock, msg, { command, body }) {
  if (!['getdp', 'getpp'].includes(command)) return;

  await reactTo(sock, msg, '⏳');

  const jid = msg.key.remoteJid;

  // Determine whose DP to fetch
  let targetJid = jid; // default: current chat

  // Check for mentions
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentioned && mentioned.length > 0) {
    targetJid = mentioned[0];
  }
  // Check for a phone number in args
  else if (body.trim()) {
    const num = body.trim().replace(/[^0-9]/g, '');
    if (num.length >= 7) {
      targetJid = `${num}@s.whatsapp.net`;
    }
  }

  try {
    let ppUrl = null;

    try {
      ppUrl = await sock.profilePictureUrl(targetJid, 'image');
    } catch {
      // Try low-res fallback
      try {
        ppUrl = await sock.profilePictureUrl(targetJid, 'preview');
      } catch {
        ppUrl = null;
      }
    }

    if (!ppUrl) {
      await reactTo(sock, msg, '❌');
      return reply(sock, msg, '❌ No profile picture found. The contact may have their privacy set to restrict profile picture visibility.');
    }

    // Download and send
    const axios = require('axios');
    const res = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 20000 });
    const imgBuffer = Buffer.from(res.data);

    const isGroup = targetJid.endsWith('@g.us');
    const num = targetJid.replace(/@.+/, '');
    const caption = isGroup
      ? `🖼️ *Group Profile Picture*\n_Fetched by ${config.BOT_NAME}_`
      : `🖼️ *Profile Picture*\n📞 +${num}\n_Fetched by ${config.BOT_NAME}_`;

    await sock.sendMessage(jid, { image: imgBuffer, caption }, { quoted: msg });
    await reactTo(sock, msg, '✅');
  } catch (err) {
    await reactTo(sock, msg, '❌');
    return reply(sock, msg, `❌ Failed to fetch profile picture: ${err.message}`);
  }
}

module.exports = { handleGetDp };
