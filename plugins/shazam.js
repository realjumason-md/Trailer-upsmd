/**
 * SHAZAM — identify a song from an audio/voice message
 */

import axios from 'axios';
import FormData from 'form-data';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';
import { reply } from '../lib/utils.js';

export async function handleShazam(sock, msg, parsed) {
  if (parsed?.command !== 'shazam') return false;

  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const audioMsg = quoted?.audioMessage || quoted?.videoMessage;

  if (!audioMsg) {
    await reply(sock, msg, '❌ Reply to an audio/voice message with .shazam');
    return true;
  }

  await reply(sock, msg, '🎵 Identifying song...');

  try {
    const quotedFull = {
      key: {
        remoteJid: msg.key.remoteJid,
        id:        msg.message.extendedTextMessage.contextInfo.stanzaId,
        fromMe:    false,
      },
      message: { audioMessage: audioMsg },
    };

    const buffer = await downloadMediaMessage(quotedFull, 'buffer', {}, {
      logger: pino({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });

    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });

    const { data } = await axios.post(
      'https://shazam-api6.p.rapidapi.com/shazam/recognize/',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'x-rapidapi-host': 'shazam-api6.p.rapidapi.com',
          'x-rapidapi-key':  process.env.RAPIDAPI_KEY || '',
        },
        timeout: 30000,
      }
    );

    const track = data?.track;
    if (!track) {
      await reply(sock, msg, '❌ Song not recognized. Make sure the audio is clear.');
      return true;
    }

    await reply(sock, msg,
      `🎵 *Song Identified!*\n\n` +
      `🎶 Title:  ${track.title}\n` +
      `🎤 Artist: ${track.subtitle}\n` +
      `💿 Album:  ${track.sections?.[0]?.metadata?.find(m => m.title === 'Album')?.text || '—'}\n` +
      `📅 Year:   ${track.sections?.[0]?.metadata?.find(m => m.title === 'Released')?.text || '—'}`
    );
  } catch (err) {
    await reply(sock, msg, `❌ Shazam failed: ${err.message}`);
  }
  return true;
}
