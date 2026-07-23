/**
 * TRAILER-UPSMD WHATSAPP BOT
 * Main entry point — connects to WhatsApp and routes all plugins
 */

require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { startServer, setBotSocket, setPairingCode, setConnected } = require('./server');
const { startAutoBio } = require('./plugins/setbio');

// Plugins
const antidelete = require('./plugins/antidelete');
const antiedit = require('./plugins/antiedit');
const autostatus = require('./plugins/autostatus');
const { handleSetBio } = require('./plugins/setbio');
const { handleSetDp } = require('./plugins/setdp');
const { handleTikTok } = require('./plugins/tiktok');
const { handleShazam } = require('./plugins/shazam');
const { handleUpdate } = require('./plugins/update');
const { handleAICommand, handleAIReply } = require('./plugins/ai');
const { storeViewOnce, handleVV } = require('./plugins/antiviewonce');
const { handleGetDp } = require('./plugins/getdp');

const { parseCommand, getMessageText, isOwner, reply } = require('./lib/utils');

// Logger — quiet unless in dev
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

// Ensure session directory exists
const SESSION_DIR = path.resolve(config.SESSION_DIR);
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let sock;
let retryCount = 0;
const MAX_RETRIES = 5;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: config.PAIRING_METHOD === 'qr',
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.macOS('Safari'),
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
  });

  setBotSocket(sock);

  // ── PAIRING CODE ─────────────────────────────────────────────
  if (!state.creds.registered && config.PAIRING_METHOD === 'phone') {
    const phone = config.PAIRING_PHONE.replace(/[^0-9]/g, '');
    await new Promise(r => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(phone);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
      setPairingCode(formatted);
      console.log('\n╔══════════════════════════════╗');
      console.log('║   📱 WHATSAPP PAIRING CODE   ║');
      console.log('╠══════════════════════════════╣');
      console.log(`║   Code: ${formatted.padEnd(20)} ║`);
      console.log('╠══════════════════════════════╣');
      console.log('║  Open WhatsApp > Settings    ║');
      console.log('║  > Linked Devices > Link a   ║');
      console.log('║  Device > Enter code above   ║');
      console.log('╚══════════════════════════════╝\n');
      console.log(`[Pairing] Also available at: http://localhost:${config.PORT}/pair`);
    } catch (e) {
      console.error('[Pairing] Failed to get code:', e.message);
    }
  }

  // ── CONNECTION UPDATES ────────────────────────────────────────
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && config.PAIRING_METHOD === 'qr') {
      try {
        const qrcode = require('qrcode-terminal');
        qrcode.generate(qr, { small: true });
        console.log('[QR] Scan the code above with WhatsApp');
      } catch {}
    }

    if (connection === 'open') {
      retryCount = 0;
      setPairingCode(null);
      setConnected(true);
      console.log(`\n✅ Connected as: ${sock.user?.name} (+${sock.user?.id?.split(':')[0]})`);
      console.log(`🤖 Bot: ${config.BOT_NAME} is online!\n`);

      // Start auto-bio rotation
      if (config.AUTO_BIO) startAutoBio(sock);
    }

    if (connection === 'close') {
      setConnected(false);
      const reason = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      console.log(`[Connection] Closed. Reason: ${reason}. Reconnect: ${shouldReconnect}`);

      if (shouldReconnect && retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        console.log(`[Connection] Reconnecting in ${delay / 1000}s... (attempt ${retryCount}/${MAX_RETRIES})`);
        setTimeout(connectToWhatsApp, delay);
      } else if (reason === DisconnectReason.loggedOut) {
        console.log('[Connection] Logged out. Delete session folder and restart to re-pair.');
        process.exit(1);
      } else {
        console.log('[Connection] Max retries reached. Restarting process...');
        process.exit(0);
      }
    }
  });

  // ── CREDENTIALS SAVE ─────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ── MESSAGES: UPSERT ─────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        // Store for anti-delete
        antidelete.storeMessage(msg);
        // Store original for anti-edit
        antiedit.storeOriginal(msg);
        // Store view-once
        storeViewOnce(msg);
        // Auto status view
        await autostatus.handleStatusUpdate(sock, msg);
        // AI reply for DMs
        await handleAIReply(sock, msg);

        // ── COMMAND ROUTING ──────────────────────────────────
        const text = getMessageText(msg);
        if (!text.startsWith(config.PREFIX)) continue;

        const parsed = parseCommand(text, config.PREFIX);
        if (!parsed) continue;

        const { command, args, body } = parsed;
        const ctx = { command, args, body };

        // Route to plugins
        switch (command) {
          // Bio
          case 'setbio':
          case 'autobio':
          case 'quotebio':
            await handleSetBio(sock, msg, ctx);
            break;

          // DP
          case 'setdp':
            await handleSetDp(sock, msg, ctx);
            break;

          // TikTok
          case 'tiktok':
          case 'tt':
            await handleTikTok(sock, msg, ctx);
            break;

          case 'tiktokaudio':
          case 'tta':
            await handleTikTok(sock, msg, { ...ctx, command: 'tiktokaudio' });
            break;

          // Shazam
          case 'shazam':
            await handleShazam(sock, msg, ctx);
            break;

          // Update / restart
          case 'update':
          case 'redeploy':
          case 'restart':
            await handleUpdate(sock, msg, ctx);
            break;

          // AI controls
          case 'aionall':
          case 'aialloff':
          case 'aion':
          case 'aioff':
            await handleAICommand(sock, msg, ctx);
            break;

          // View-once reveal
          case 'vv':
            await handleVV(sock, msg, ctx);
            break;

          // Get profile picture
          case 'getdp':
          case 'getpp':
            await handleGetDp(sock, msg, ctx);
            break;

          // Help
          case 'help':
          case 'menu':
            await sendHelp(sock, msg);
            break;

          // Ping
          case 'ping':
            await reply(sock, msg, `🏓 Pong! _${Date.now()}ms_`);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[Bot] Message handler error:', err.message);
      }
    }
  });

  // ── MESSAGE UPDATES (deletions & edits) ──────────────────────
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      try {
        // Anti-delete: protocol message with revoke type
        if (update.update?.message?.protocolMessage?.type === 0) {
          await antidelete.handleDelete(sock, {
            key: update.update.message.protocolMessage.key,
          });
        }
        // Anti-edit: protocol message with edit type
        if (update.update?.message?.protocolMessage?.type === 14) {
          const fakeMsg = {
            key: update.key,
            message: update.update.message,
          };
          await antiedit.handleEdit(sock, fakeMsg);
        }
      } catch (err) {
        console.error('[Update] Handler error:', err.message);
      }
    }
  });

  // ── MESSAGE DELETE EVENTS ─────────────────────────────────────
  sock.ev.on('messages.delete', async (item) => {
    try {
      if ('keys' in item) {
        for (const key of item.keys) {
          await antidelete.handleDelete(sock, { key });
        }
      }
    } catch (err) {
      console.error('[Delete] Handler error:', err.message);
    }
  });

  return sock;
}

async function sendHelp(sock, msg) {
  const prefix = config.PREFIX;
  const text =
    `╔══════════════════════════╗\n` +
    `║  🤖 ${config.BOT_NAME.padEnd(20)} ║\n` +
    `╚══════════════════════════╝\n\n` +
    `*📥 DOWNLOADER*\n` +
    `▸ ${prefix}tiktok <url> — TikTok video\n` +
    `▸ ${prefix}tiktokaudio <url> — TikTok audio\n` +
    `▸ ${prefix}shazam — Identify song (reply to audio)\n\n` +
    `*🛡️ PROTECTION*\n` +
    `▸ Anti-Delete: AUTO (shows deleted msgs)\n` +
    `▸ Anti-Edit: AUTO (shows original before edit)\n` +
    `▸ Auto Status View: AUTO\n` +
    `▸ ${prefix}vv — Reveal view-once media\n\n` +
    `*👤 PROFILE*\n` +
    `▸ ${prefix}setbio <text> — Set your bio\n` +
    `▸ ${prefix}autobio on/off — Auto gangster quotes bio\n` +
    `▸ ${prefix}quotebio — Set random gangster quote as bio\n` +
    `▸ ${prefix}setdp — Set profile pic (attach or reply to image)\n\n` +
    `*🤖 AI REPLY*\n` +
    `▸ ${prefix}aionall — AI on for ALL DM chats\n` +
    `▸ ${prefix}aialloff — AI off for all chats\n` +
    `▸ ${prefix}aion — AI on for this chat\n` +
    `▸ ${prefix}aioff — AI off for this chat\n\n` +
    `*⚙️ SYSTEM*\n` +
    `▸ ${prefix}update — Pull latest updates from GitHub\n` +
    `▸ ${prefix}restart — Restart bot (session preserved)\n` +
    `▸ ${prefix}ping — Check if bot is alive\n\n` +
    `_Owner only commands marked with 🔒_`;

  await reply(sock, msg, text);
}

// ── BOOT ─────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════╗');
  console.log(`║  🤖 ${config.BOT_NAME.padEnd(28)} ║`);
  console.log('║  Starting up...                  ║');
  console.log('╚══════════════════════════════════╝\n');

  startServer();
  await connectToWhatsApp();
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});

module.exports = { connectToWhatsApp };
