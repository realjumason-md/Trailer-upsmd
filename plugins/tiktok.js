/**
 * TIKTOK DOWNLOADER
 */

import axios from 'axios';
import config from '../config.js';
import { isOwner, reply } from '../lib/utils.js';

export async function handleTikTok(sock, msg, parsed) {
  const { command, args } = parsed;
  if (!['tiktok', 'tiktokaudio', 'tt'].includes(command)) return false;

  const url = args[0];
  if (!url) {
    await reply(sock, msg, `❌ Usage: ${config.PREFIX}tiktok <url>`);
    return true;
  }

  await reply(sock, msg, '⏳ Fetching TikTok media...');

  try {
    const { data } = await axios.get(config.TIKTOK_API, {
      params: { url, hd: 1 },
      timeout: 30000,
    });

    if (!data?.data) throw new Error('No data returned from API');

    const d    = data.data;
    const isAudio = command === 'tiktokaudio';

    if (isAudio) {
      const audioUrl = d.music_info?.play || d.hdplay || d.play;
      if (!audioUrl) throw new Error('No audio found');
      await sock.sendMessage(msg.key.remoteJid, {
        audio:    { url: audioUrl },
        mimetype: 'audio/mp4',
        caption:  `🎵 ${d.title || 'TikTok Audio'}`,
      }, { quoted: msg });
    } else {
      const videoUrl = d.hdplay || d.play;
      if (!videoUrl) throw new Error('No video found');
      await sock.sendMessage(msg.key.remoteJid, {
        video:   { url: videoUrl },
        caption: `🎬 ${d.title || 'TikTok Video'}\n👤 ${d.author?.nickname || ''}`,
      }, { quoted: msg });
    }
  } catch (err) {
    await reply(sock, msg, `❌ TikTok download failed: ${err.message}`);
  }
  return true;
}
