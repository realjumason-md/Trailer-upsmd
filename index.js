/**
 * TRAILER-UPSMD WHATSAPP BOT
 * Main entry point — connects to WhatsApp and routes all plugins
 */

require('dotenv').config();

if (process.versions?.bun || typeof Bun !== 'undefined') {
  console.error('[Runtime] Bun is not supported for this bot.');
  console.error('[Runtime] Select Node.js 20+ in Wispbyte and start with: npm run start:optimized');
  process.exit(1);
}

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
const readline = require('readline');
const config = require('./config');
const { startServer, setBotSocket, setConnected } = require('./server');
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
let socketGeneration = 0;
let pairingPhone = null;
let pairingPhonePromise = null;
let pairingReadline = null;
let pairingReadlineClosed = false;

function normalizePairingPhone(value) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);

  if (phone.length < 7 || phone.length > 15) {
    throw new Error(
      'Invalid phone number. Use the country code and digits only, for example 256706106326.'
    );
  }
  if (phone.startsWith('0')) {
    throw new Error(
      'Include the country code and remove the local leading zero, for example 256706106326.'
    );
  }
  return phone;
}

function closePairingReadline() {
  if (pairingReadline && !pairingReadlineClosed) {
    pairingReadlineClosed = true;
    pairingReadline.close();
  }
  pairingReadline = null;
}

function getPairingPhone() {
  if (pairingPhone) return Promise.resolve(pairingPhone);
  if (pairingPhonePromise) return pairingPhonePromise;

  pairingPhonePromise = (async () => {
    if (config.PAIRING_PHONE) {
      const phone = normalizePairingPhone(config.PAIRING_PHONE);
      console.log(`[Pairing] Using configured phone number ending in ${phone.slice(-4)}.`);
      pairingPhone = phone;
      return phone;
    }

    if (!process.stdin || process.stdin.destroyed || process.stdin.readable === false) {
      throw new Error(
        'No usable console input is available. Set PAIRING_PHONE in the host environment and restart.'
      );
    }

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  📱 WHATSAPP CONSOLE PAIRING             ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Include country code; digits only       ║');
    console.log('║  Example: 256706106326                   ║');
    console.log('╚══════════════════════════════════════════╝');

    pairingReadlineClosed = false;
    pairingReadline = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise((resolve) => {
      pairingReadline.question('WhatsApp number: ', resolve);
    });
    closePairingReadline();
    const phone = normalizePairingPhone(answer);
    pairingPhone = phone;
    return phone;
  })().finally(() => {
    pairingPhonePromise = null;
  });

  return pairingPhonePromise;
}

function cancelConsolePairing(currentSock) {
  if (currentSock?.__trailerPairingTimer) {
    clearTimeout(currentSock.__trailerPairingTimer);
    currentSock.__trailerPairingTimer = null;
  }
  if (currentSock?.__trailerPairingRetryTimer) {
    clearTimeout(currentSock.__trailerPairingRetryTimer);
    currentSock.__trailerPairingRetryTimer = null;
  }
  if (currentSock) {
    currentSock.__trailerPairingScheduled = false;
    currentSock.__trailerPairingStarted = false;
  }
}

function scheduleConsolePairing(currentSock, generation) {
  if (
    config.PAIRING_METHOD === 'qr' ||
    currentSock.__trailerPairingScheduled ||
    currentSock.__trailerAuthState?.creds?.registered
  ) return;
  currentSock.__trailerPairingScheduled = true;

  // Give the initial WebSocket handshake time to become usable. A fixed
  // request immediately at process startup can return a code that WhatsApp
  // rejects because the registration transport is not ready yet.
  currentSock.__trailerPairingTimer = setTimeout(() => {
    currentSock.__trailerPairingTimer = null;
    if (generation !== socketGeneration || currentSock !== sock) return;
    if (currentSock.__trailerConnection === 'close' || currentSock.__trailerConnection === 'open') return;
    generateConsolePairingCode(currentSock, generation).catch((error) => {
      console.error(`[Pairing] Fatal pairing attempt error: ${error.message}`);
    });
  }, 2500);
}

function clearStaleUnregisteredSession() {
  const credsPath = path.join(SESSION_DIR, 'creds.json');
  if (!fs.existsSync(credsPath)) return;

  try {
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    if (creds.registered === false) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      console.log('[Session] Removed an incomplete registration; starting fresh pairing.');
    }
  } catch (error) {
    console.error(`[Session] Could not inspect saved credentials: ${error.message}`);
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const generation = ++socketGeneration;

  const currentSock = makeWASocket({
    version,
    logger,
    printQRInTerminal: config.PAIRING_METHOD === 'qr',
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    // Match MEGA-MD's accepted desktop identity. Chrome is more reliable
    // than the previous Safari identity for phone-number registration.
    browser: Browsers.macOS('Chrome'),
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  sock = currentSock;
  currentSock.__trailerAuthState = state;
  setBotSocket(currentSock);

  // ── CONNECTION UPDATES ────────────────────────────────────────
  currentSock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (generation !== socketGeneration || currentSock !== sock) return;
    currentSock.__trailerConnection = connection || currentSock.__trailerConnection;

    if (qr && config.PAIRING_METHOD === 'qr') {
      try {
        const qrcode = require('qrcode-terminal');
        qrcode.generate(qr, { small: true });
        console.log('[QR] Scan the code above with WhatsApp');
      } catch {}
    }

    // Pair only after Baileys has started the current socket. This replaces
    // the old blind startup timer and avoids stale codes from a closing socket.
    if (connection === 'connecting' && !state.creds.registered) {
      scheduleConsolePairing(currentSock, generation);
    }

    if (connection === 'open') {
      retryCount = 0;
      cancelConsolePairing(currentSock);
      closePairingReadline();
      setConnected(true);
      console.log(`\n✅ Connected as: ${sock.user?.name} (+${sock.user?.id?.split(':')[0]})`);
      console.log(`🤖 Bot: ${config.BOT_NAME} is online!\n`);

      // Start auto-bio rotation
      if (config.AUTO_BIO) startAutoBio(sock);
    }

    if (connection === 'close') {
      cancelConsolePairing(currentSock);
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
        // Exit non-zero so Railway, Render, Fly.io, Heroku, and other
        // process managers restart the bot instead of treating this as a
        // successful shutdown.
        process.exit(1);
      }
    }
  });

  // ── CREDENTIALS SAVE ─────────────────────────────────────────
  currentSock.ev.on('creds.update', saveCreds);

  // ── CONSOLE PAIRING ───────────────────────────────────────────
  // Wispbyte's console sends stdin to the Node process. Ask for the number
  // there and print the pairing code back into that same console.
  if (!state.creds.registered && config.PAIRING_METHOD !== 'qr') {
    // Some Baileys versions emit no separate connecting event. Keep a guarded
    // fallback, but never run it against a replaced socket.
    setTimeout(() => {
      if (generation === socketGeneration && currentSock === sock) {
        scheduleConsolePairing(currentSock, generation);
      }
    }, 5000);
  }

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

async function generateConsolePairingCode(socket, generation, attempt = 1) {
  if (generation !== socketGeneration || socket !== sock) return;
  if (socket.__trailerPairingStarted || socket.__trailerAuthState?.creds?.registered) return;
  if (socket.__trailerConnection === 'close' || socket.__trailerConnection === 'open') return;
  socket.__trailerPairingStarted = true;

  try {
    const phone = await getPairingPhone();
    if (generation !== socketGeneration || socket !== sock) return;
    if (socket.__trailerConnection === 'close' || socket.__trailerConnection === 'open') return;

    const code = await socket.requestPairingCode(phone);
    if (!code) throw new Error('WhatsApp returned an empty pairing code.');
    if (
      generation !== socketGeneration ||
      socket !== sock ||
      socket.__trailerConnection === 'close' ||
      socket.__trailerConnection === 'open' ||
      socket.__trailerAuthState?.creds?.registered
    ) {
      return;
    }

    const formatted = code.match(/.{1,4}/g)?.join('-') || code;
    closePairingReadline();

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  ✅ WHATSAPP PAIRING CODE                ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  ${String(formatted).padEnd(40)}║`);
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Enter it immediately on your phone:    ║');
    console.log('║  WhatsApp → Linked Devices → Link device ║');
    console.log('║  → Link with phone number instead        ║');
    console.log('╚══════════════════════════════════════════╝\n');
  } catch (error) {
    socket.__trailerPairingStarted = false;
    const message = error?.message || String(error);
    console.error(`[Pairing] Attempt ${attempt}/3 failed: ${message}`);

    if (generation !== socketGeneration || socket !== sock) return;
    if (attempt < 3 && !socket.__trailerAuthState?.creds?.registered) {
      const retryDelay = attempt * 3000;
      console.log(`[Pairing] Retrying this active socket in ${retryDelay / 1000}s...`);
      socket.__trailerPairingRetryTimer = setTimeout(() => {
        socket.__trailerPairingRetryTimer = null;
        if (generation === socketGeneration && socket === sock) {
          generateConsolePairingCode(socket, generation, attempt + 1);
        }
      }, retryDelay);
    } else {
      console.error('[Pairing] No usable code was returned after three attempts.');
      console.error('[Pairing] Check that Wispbyte is using Node.js 20+ and restart only after reviewing this error.');
    }
  }
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

  clearStaleUnregisteredSession();
  startServer();
  await connectToWhatsApp();
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});

module.exports = { connectToWhatsApp };
