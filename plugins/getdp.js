/**
 * GET DP — fetch any contact's profile picture
 */

import { reply } from '../lib/utils.js';

export async function handleGetDp(sock, msg, parsed) {
  if (parsed?.command !== 'getdp') return false;

  const mentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    msg.message?.extendedTextMessage?.contextInfo?.participant;

  const target = mentioned || `${parsed.args[0]?.replace(/\D/g, '')}@s.whatsapp.net`;

  if (!target || target === '@s.whatsapp.net') {
    await reply(sock, msg, '❌ Usage: .getdp @mention  or  .getdp <number>');
    return true;
  }

  try {
    const url = await sock.profilePictureUrl(target, 'image');
    await sock.sendMessage(msg.key.remoteJid, { image: { url }, caption: `📸 Profile picture of ${target.split('@')[0]}` }, { quoted: msg });
  } catch {
    await reply(sock, msg, '❌ No profile picture found (private or not on WhatsApp).');
  }
  return true;
}
