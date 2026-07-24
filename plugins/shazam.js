/**
 * SHAZAM — identify a song from audio or video
 * Based on MEGA-MD's shazam.js
 *
 * Key improvements:
 *  - Uses downloadContentFromMessage (stream-based, Baileys 7.x reliable)
 *  - Supports direct audio/video AND quoted audio/video (MEGA-MD approach)
 *  - Primary: RapidAPI (if RAPIDAPI_KEY set in config)
 *  - Free fallback: ACRCloud HTTP API with MEGA-MD's bundled keys (no user setup needed)
 */

import axios from 'axios';
import FormData from 'form-data';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import config from '../config.js';
import { reply } from '../lib/utils.js';

const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── ACRCloud free recognition (MEGA-MD bundled keys, no user setup needed) ─────
const ACR = {
  host:   'identify-eu-west-1.acrcloud.com',
  key:    'c33c767d683f78bd17d4bd4991955d81',
  secret: 'bvgaIAEtADBTbLwiPGYlxupWqkNGIjT7J9Ag2vIu',
};

function acrSign(timestamp) {
  const str = `POST\n/v1/identify\n${ACR.key}\naudio\n1\n${timestamp}`;
  return crypto.createHmac('sha1', ACR.secret).update(str).digest('base64');
}

async function identifyWithACR(filePath) {
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('sample',           fs.createReadStream(filePath));
  form.append('access_key',       ACR.key);
  form.append('data_type',        'audio');
  form.append('signature_version','1');
  form.append('signature',        acrSign(timestamp));
  form.append('sample_bytes',     fs.statSync(filePath).size.toString());
  form.append('timestamp',        timestamp.toString());

  const { data } = await axios.post(
    `https://${ACR.host}/v1/identify`,
    form,
    { headers: form.getHeaders(), timeout: 30000 }
  );
  return data;
}

// ── Media helpers ──────────────────────────────────────────────────────────────
function getMedia(msg) {
  const m = msg.message || {};
  // Direct attachment
  if (m.audioMessage) return { msg: m.audioMessage, type: 'audio', ext: '.mp3' };
  if (m.videoMessage) return { msg: m.videoMessage, type: 'video', ext: '.mp4' };
  // Quoted message
  const q = m.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!q) return null;
  if (q.audioMessage) return { msg: q.audioMessage, type: 'audio', ext: '.mp3' };
  if (q.videoMessage) return { msg: q.videoMessage, type: 'video', ext: '.mp4' };
  return null;
}

async function downloadToTmp(mediaMsg, type, ext) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const tmpPath = path.join(TEMP_DIR, `shazam_${Date.now()}${ext}`);
  fs.writeFileSync(tmpPath, Buffer.concat(chunks));
  return tmpPath;
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function handleShazam(sock, msg, parsed) {
  if (parsed?.command !== 'shazam') return false;

  const media = getMedia(msg);
  if (!media) {
    await reply(sock, msg,
      '❌ Reply to an audio/voice/video message with .shazam\n' +
      '_Or send audio directly and type .shazam_'
    );
    return true;
  }

  await reply(sock, msg, '🎵 Identifying song...');

  let tmpPath = null;
  try {
    tmpPath = await downloadToTmp(media.msg, media.type, media.ext);

    // ── RapidAPI (if configured) ─────────────────────────────────────────────
    if (config.RAPIDAPI_KEY) {
      try {
        const form = new FormData();
        form.append('file', fs.createReadStream(tmpPath), {
          filename:    `audio${media.ext}`,
          contentType: 'audio/ogg',
        });
        const { data } = await axios.post(
          'https://shazam-api6.p.rapidapi.com/shazam/recognize/',
          form,
          {
            headers: {
              ...form.getHeaders(),
              'x-rapidapi-host': 'shazam-api6.p.rapidapi.com',
              'x-rapidapi-key':  config.RAPIDAPI_KEY,
            },
            timeout: 30000,
          }
        );
        const track = data?.track;
        if (track) {
          await reply(sock, msg,
            `🎵 *Song Identified!*\n\n` +
            `🎶 *Title:*  ${track.title}\n` +
            `🎤 *Artist:* ${track.subtitle}\n` +
            `💿 *Album:*  ${track.sections?.[0]?.metadata?.find(m => m.title === 'Album')?.text || '—'}\n` +
            `📅 *Year:*   ${track.sections?.[0]?.metadata?.find(m => m.title === 'Released')?.text || '—'}`
          );
          return true;
        }
      } catch (err) {
        console.error('[Shazam] RapidAPI failed, trying ACRCloud:', err.message);
      }
    }

    // ── ACRCloud free fallback (MEGA-MD bundled keys) ────────────────────────
    const res = await identifyWithACR(tmpPath);
    if (res.status?.code === 0) {
      const music = res.metadata?.music?.[0];
      if (music) {
        await reply(sock, msg,
          `🎵 *Song Identified!*\n\n` +
          `🎶 *Title:*   ${music.title || '—'}\n` +
          `🎤 *Artist:*  ${music.artists?.map(a => a.name).join(', ') || '—'}\n` +
          `💿 *Album:*   ${music.album?.name || '—'}\n` +
          `🌐 *Genre:*   ${music.genres?.map(g => g.name).join(', ') || '—'}\n` +
          `📅 *Released:* ${music.release_date || '—'}`
        );
        return true;
      }
    }

    await reply(sock, msg, '❌ Song not recognized. Make sure the audio is clear and at least 10 seconds long.');
  } catch (err) {
    await reply(sock, msg, `❌ Shazam failed: ${err.message}`);
  } finally {
    if (tmpPath) try { fs.unlinkSync(tmpPath); } catch {}
  }
  return true;
}
