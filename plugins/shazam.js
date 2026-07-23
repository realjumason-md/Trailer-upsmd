/**
 * SHAZAM PLUGIN
 * .shazam — reply to an audio/voice/video message to identify the song
 */

const axios = require('axios');
const { isOwner, reply, reactTo, downloadMedia, getMessageType } = require('../lib/utils');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../config');

async function recognizeSong(audioBuffer) {
  // Use audd.io free tier (no key needed for basic use)
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', audioBuffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
  form.append('return', 'apple_music,spotify');

  const res = await axios.post('https://api.audd.io/', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });

  return res.data;
}

async function handleShazam(sock, msg, { command }) {
  if (command !== 'shazam') return;

  await reactTo(sock, msg, '⏳');

  // Get the message to process — either this message or the quoted one
  let targetMsg = msg;
  const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quotedMsg) {
    const qType = Object.keys(quotedMsg)[0];
    if (['audioMessage', 'videoMessage', 'pttMessage'].includes(qType)) {
      // Build a fake message object for downloading
      targetMsg = {
        key: {
          ...msg.key,
          id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId || msg.key.id,
        },
        message: quotedMsg,
      };
    }
  }

  const type = targetMsg === msg ? getMessageType(msg) : Object.keys(targetMsg.message)[0];

  if (!['audioMessage', 'videoMessage', 'pttMessage'].includes(type)) {
    await reactTo(sock, msg, '❌');
    return reply(
      sock, msg,
      '❌ Please reply to an audio, voice note, or video message with .shazam'
    );
  }

  try {
    const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
      logger: require('pino')({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });

    if (!buffer) {
      await reactTo(sock, msg, '❌');
      return reply(sock, msg, '❌ Could not download audio.');
    }

    const result = await recognizeSong(buffer);

    if (!result || result.status !== 'success' || !result.result) {
      await reactTo(sock, msg, '🔍');
      return reply(sock, msg, '🔍 Song not recognized. Try a clearer audio clip.');
    }

    const song = result.result;
    const text =
      `🎵 *Song Identified!*\n\n` +
      `🎶 *Title:* ${song.title}\n` +
      `🎤 *Artist:* ${song.artist}\n` +
      `💿 *Album:* ${song.album || 'N/A'}\n` +
      `📅 *Release:* ${song.release_date || 'N/A'}\n` +
      (song.spotify?.external_urls?.spotify ? `\n🟢 *Spotify:* ${song.spotify.external_urls.spotify}` : '') +
      (song.apple_music?.url ? `\n🍎 *Apple Music:* ${song.apple_music.url}` : '') +
      `\n\n_Identified by ${config.BOT_NAME} 🎵_`;

    await reactTo(sock, msg, '✅');
    return reply(sock, msg, text);
  } catch (err) {
    await reactTo(sock, msg, '❌');
    return reply(sock, msg, `❌ Shazam error: ${err.message}`);
  }
}

module.exports = { handleShazam };
