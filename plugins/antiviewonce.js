/**
 * ANTI VIEW-ONCE PLUGIN
 * .vv — reply to a view-once photo/video to re-send it normally
 * Also optionally auto-saves all view-once media sent to you
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../config');
const { isOwner, reply, reactTo } = require('../lib/utils');

// Store view-once messages as they arrive { msgId -> msg }
const viewOnceStore = new Map();
const MAX_STORE = 500;

function extractViewOnce(msg) {
  const m = msg.message;
  if (!m) return null;

  // Standard view once wrapper
  if (m.viewOnceMessage?.message) return m.viewOnceMessage.message;
  if (m.viewOnceMessageV2?.message) return m.viewOnceMessageV2.message;
  if (m.viewOnceMessageV2Extension?.message) return m.viewOnceMessageV2Extension.message;
  if (m.ephemeralMessage?.message?.viewOnceMessage?.message) return m.ephemeralMessage.message.viewOnceMessage.message;

  return null;
}

function storeViewOnce(msg) {
  const voContent = extractViewOnce(msg);
  if (!voContent) return;

  if (viewOnceStore.size >= MAX_STORE) {
    const firstKey = viewOnceStore.keys().next().value;
    viewOnceStore.delete(firstKey);
  }

  viewOnceStore.set(msg.key.id, {
    msg: { ...msg, message: voContent },
    originalMsg: msg,
    chat: msg.key.remoteJid,
    sender: msg.key.participant || msg.key.remoteJid,
    timestamp: Date.now(),
  });
}

async function handleVV(sock, msg, { command }) {
  if (command !== 'vv') return;

  const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
  const quotedId = contextInfo?.stanzaId;
  const quotedMsg = contextInfo?.quotedMessage;

  if (!quotedId && !quotedMsg) {
    return reply(sock, msg, '❌ Reply to a view-once photo or video with .vv to reveal it.');
  }

  // Try to find in store first
  let storedEntry = viewOnceStore.get(quotedId);

  // If not in store but we have quotedMessage context
  let voContent = null;
  if (storedEntry) {
    voContent = storedEntry.msg.message;
  } else if (quotedMsg) {
    // Extract from quoted message directly
    const fakeMsg = { key: msg.key, message: quotedMsg };
    voContent = extractViewOnce(fakeMsg);
  }

  if (!voContent) {
    return reply(sock, msg, '❌ View-once message not found or already expired. The .vv command must be used before the media expires.');
  }

  await reactTo(sock, msg, '⏳');

  try {
    const type = Object.keys(voContent)[0];
    const targetMsg = {
      key: { ...msg.key, id: quotedId || msg.key.id },
      message: voContent,
    };

    const buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
      logger: require('pino')({ level: 'silent' }),
      reuploadRequest: sock.updateMediaMessage,
    });

    if (!buffer) {
      await reactTo(sock, msg, '❌');
      return reply(sock, msg, '❌ Could not download view-once media.');
    }

    const jid = msg.key.remoteJid;
    const caption = `🔓 *View-Once Revealed*\n_${config.BOT_NAME}_`;

    if (type === 'imageMessage') {
      await sock.sendMessage(jid, { image: buffer, caption }, { quoted: msg });
    } else if (type === 'videoMessage') {
      await sock.sendMessage(jid, { video: buffer, caption }, { quoted: msg });
    } else if (type === 'audioMessage' || type === 'pttMessage') {
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      }, { quoted: msg });
      await reply(sock, msg, caption);
    } else {
      await reactTo(sock, msg, '❌');
      return reply(sock, msg, `❌ Unsupported view-once type: ${type}`);
    }

    await reactTo(sock, msg, '✅');
  } catch (err) {
    await reactTo(sock, msg, '❌');
    return reply(sock, msg, `❌ Error: ${err.message}`);
  }
}

module.exports = { storeViewOnce, handleVV };
