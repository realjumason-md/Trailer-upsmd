/**
 * TIKTOK DOWNLOADER
 * Based on MEGA-MD's tiktok.js
 *
 * Key improvements:
 *  - Primary API: discardapi.onrender.com (richer data — stats, HD, author)
 *  - Falls back to tikwm.com if discardapi fails
 *  - Rich caption: author, region, duration, likes, comments, shares, sound
 *  - HD no-watermark video when available
 *  - Audio: sends title as text first (WhatsApp audio has no caption field)
 */

import axios from 'axios';
import config from '../config.js';
import { reply } from '../lib/utils.js';

async function fetchTikTok(url) {
  // Primary: discardapi (MEGA-MD)
  try {
    const { data } = await axios.get(
      `https://discardapi.onrender.com/api/dl/tiktok?apikey=guru&url=${encodeURIComponent(url)}`,
      {
        timeout: 45000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }
    );
    if (data?.status && data?.result) return { source: 'discardapi', d: data.result };
  } catch (err) {
    console.error('[TikTok] discardapi failed, trying fallback:', err.message);
  }

  // Fallback: tikwm
  const { data } = await axios.get(config.TIKTOK_API, {
    params: { url, hd: 1 },
    timeout: 30000,
  });
  if (!data?.data) throw new Error('No data returned from any TikTok API');
  return { source: 'tikwm', d: data.data };
}

export async function handleTikTok(sock, msg, parsed) {
  const { command, args } = parsed;
  if (!['tiktok', 'tiktokaudio', 'tt', 'ttdl'].includes(command)) return false;

  const url = args[0];
  if (!url) {
    await reply(sock, msg, `❌ Usage: ${config.PREFIX}tiktok <url>`);
    return true;
  }

  await reply(sock, msg, '⏳ Fetching TikTok media...');

  const isAudio = command === 'tiktokaudio';

  try {
    const { source, d } = await fetchTikTok(url);

    if (isAudio) {
      const audioUrl = d.music_info?.play || d.hdplay || d.play;
      if (!audioUrl) throw new Error('No audio found');
      await reply(sock, msg, `🎵 *${d.title || 'TikTok Audio'}*\n🎧 ${d.music_info?.title || ''}`);
      await sock.sendMessage(msg.key.remoteJid, { audio: { url: audioUrl }, mimetype: 'audio/mp4' }, { quoted: msg });
      return true;
    }

    if (source === 'discardapi') {
      const hd    = d.data?.find(v => v.type === 'nowatermark_hd');
      const noWm  = d.data?.find(v => v.type === 'nowatermark');
      const videoUrl = hd?.url || noWm?.url || d.hdplay || d.play;
      if (!videoUrl) throw new Error('No video found');

      const caption =
        `🎵 *TikTok Downloader*\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *User:* ${d.author?.nickname || d.author?.fullname || 'Unknown'}\n` +
        `🌍 *Region:* ${d.region || '—'}\n` +
        `⏱️ *Duration:* ${d.duration || '—'}\n\n` +
        `❤️ *Likes:* ${d.stats?.likes    ?? d.digg_count    ?? '—'}\n` +
        `💬 *Comments:* ${d.stats?.comment ?? d.comment_count ?? '—'}\n` +
        `🔁 *Shares:* ${d.stats?.share   ?? d.share_count   ?? '—'}\n` +
        `👀 *Views:* ${d.stats?.views    ?? d.play_count    ?? '—'}\n\n` +
        `🎧 *Sound:* ${d.music_info?.title || '—'}\n` +
        `✨ *Quality:* ${hd ? 'HD No Watermark' : 'No Watermark'}\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📝 ${(d.title || 'No caption').slice(0, 200)}`;

      await sock.sendMessage(msg.key.remoteJid, { video: { url: videoUrl }, mimetype: 'video/mp4', caption }, { quoted: msg });
    } else {
      // tikwm fallback
      const videoUrl = d.hdplay || d.play;
      if (!videoUrl) throw new Error('No video found');
      await sock.sendMessage(msg.key.remoteJid, {
        video:   { url: videoUrl },
        caption: `🎬 ${d.title || 'TikTok Video'}\n👤 ${d.author?.nickname || ''}\n✨ No Watermark`,
      }, { quoted: msg });
    }
  } catch (err) {
    await reply(sock, msg, `❌ TikTok download failed: ${err.message}`);
  }
  return true;
}
