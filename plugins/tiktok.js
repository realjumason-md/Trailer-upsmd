/**
 * TIKTOK PLUGIN
 * .tiktok <url>  — download TikTok video (no watermark)
 * .tiktokaudio <url> — download TikTok audio only
 */

const axios = require('axios');
const config = require('../config');
const { isOwner, reply, reactTo } = require('../lib/utils');

async function fetchTikTok(url) {
  // Try tikwm.com API (free, no key needed)
  const res = await axios.post(
    'https://www.tikwm.com/api/',
    new URLSearchParams({ url, hd: '1' }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000,
    }
  );
  return res.data;
}

async function downloadBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  return Buffer.from(res.data);
}

async function handleTikTok(sock, msg, { command, body }) {
  if (!['tiktok', 'tiktokaudio', 'tt', 'tta'].includes(command)) return;

  const url = body.trim();
  if (!url || !url.includes('tiktok')) {
    return reply(sock, msg, '❌ Please provide a valid TikTok URL.\n\nExample: .tiktok https://vt.tiktok.com/xxxxx');
  }

  await reactTo(sock, msg, '⏳');

  try {
    const data = await fetchTikTok(url);

    if (!data || data.code !== 0 || !data.data) {
      return reply(sock, msg, '❌ Failed to fetch TikTok data. The link may be invalid or private.');
    }

    const info = data.data;
    const title = info.title || 'TikTok';
    const author = info.author?.nickname || 'Unknown';
    const plays = info.play_count?.toLocaleString() || '?';
    const likes = info.digg_count?.toLocaleString() || '?';

    if (command === 'tiktok' || command === 'tt') {
      // Video
      const videoUrl = info.play || info.hdplay;
      if (!videoUrl) return reply(sock, msg, '❌ Could not get video URL.');

      const videoBuffer = await downloadBuffer(videoUrl);
      const caption =
        `🎵 *${title}*\n` +
        `👤 *@${author}*\n` +
        `▶️ ${plays} plays  ❤️ ${likes} likes\n\n` +
        `_Downloaded by ${config.BOT_NAME}_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { video: videoBuffer, caption },
        { quoted: msg }
      );
    } else {
      // Audio only
      const audioUrl = info.music || info.music_info?.play;
      if (!audioUrl) return reply(sock, msg, '❌ Could not get audio URL.');

      const audioBuffer = await downloadBuffer(audioUrl);
      const caption =
        `🎵 *${info.music_info?.title || title}*\n` +
        `👤 *${info.music_info?.author || author}*\n\n` +
        `_Downloaded by ${config.BOT_NAME}_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        {
          audio: audioBuffer,
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: `${title}.mp3`,
        },
        { quoted: msg }
      );
      await reply(sock, msg, caption);
    }

    await reactTo(sock, msg, '✅');
  } catch (err) {
    await reactTo(sock, msg, '❌');
    return reply(sock, msg, `❌ Error: ${err.message}`);
  }
}

module.exports = { handleTikTok };
