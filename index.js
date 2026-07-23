/**
 * TRAILER-UPS BOT — Main entry point
 * Connects to WhatsApp, handles reconnects, and routes all plugins.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import chalk from 'chalk';
import QRCode from 'qrcode';
import { parsePhoneNumber } from 'awesome-phonenumber';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
  delay,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import pino from 'pino';

import config from './config.js';
import { startServer, setConnected } from './server.js';
import { startAutoBio, handleSetBio } from './plugins/setbio.js';
import { handleSetDp } from './plugins/setdp.js';
import { handleTikTok } from './plugins/tiktok.js';
import { handleShazam } from './plugins/shazam.js';
import { handleUpdate } from './plugins/update.js';
import { handleAICommand, handleAIReply } from './plugins/ai.js';
import { storeViewOnce, handleVV, handleAntiViewOnceCommand } from './plugins/antiviewonce.js';
import { handleGetDp } from './plugins/getdp.js';
import antidelete, { handleAntiDeleteCommand } from './plugins/antidelete.js';
import antiedit, { handleAntiEditCommand, handleEditUpsert } from './plugins/antiedit.js';
import autostatus, { handleAutoStatusCommand } from './plugins/autostatus.js';
import { parseCommand, getMessageText, isOwner, reply } from './lib/utils.js';
import { loadSession } from './lib/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Logger ──────────────────────────────────────────────────────────────────
const logger = pino({ level: 'silent' });

export function printLog(type, message) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  const colors = { info: chalk.blue, success: chalk.green, warning: chalk.yellow, error: chalk.red };
  const icons  = { info: '💡', success: '✅', warning: '⚠️', error: '❌' };
  const color  = colors[type] || chalk.white;
  const icon   = icons[type]  || '•';
  console.log(`${chalk.gray(`[${ts}]`)} ${color(icon)} ${color(message)}`);
}

// ─── Session directory ────────────────────────────────────────────────────────
const SESSION_DIR = path.resolve(config.SESSION_DIR);
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// ─── Phone number input ───────────────────────────────────────────────────────
let rl       = null;
let rlClosed = false;

if (process.stdin.isTTY && !config.PAIRING_NUMBER) {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('close', () => { rlClosed = true; });
}

const question = (text) =>
  rl && !rlClosed
    ? new Promise(resolve => rl.question(text, resolve))
    : Promise.resolve(config.PAIRING_NUMBER || config.OWNER_NUMBER);

process.on('exit',   () => { if (rl && !rlClosed) rl.close(); });
process.on('SIGINT', () => { if (rl && !rlClosed) rl.close(); process.exit(0); });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hasValidSession() {
  const credsPath = path.join(SESSION_DIR, 'creds.json');
  if (!fs.existsSync(credsPath)) return false;
  try {
    const raw = fs.readFileSync(credsPath, 'utf8');
    if (!raw.trim()) { printLog('warning', 'creds.json is empty'); return false; }
    const creds = JSON.parse(raw);
    if (!creds.noiseKey || !creds.signedIdentityKey || !creds.signedPreKey) {
      printLog('warning', 'creds.json is missing required Signal fields');
      return false;
    }
    if (creds.registered === false) {
      printLog('warning', 'Session exists but is not registered — clearing for fresh pairing');
      try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      return false;
    }
    printLog('success', 'Valid registered session found');
    return true;
  } catch (err) {
    printLog('warning', `Could not parse creds.json: ${err.message}`);
    return false;
  }
}

// ─── Main connect loop ────────────────────────────────────────────────────────
const useQR      = process.argv.includes('--qr-code');
const msgRetryCache = new NodeCache();

async function connectToWhatsApp() {
  // Try restoring a session from SESSION_ID env if no local session exists
  if (!hasValidSession() && config.SESSION_ID) {
    printLog('info', 'Restoring session from SESSION_ID...');
    const ok = await loadSession(SESSION_DIR, config.SESSION_ID);
    if (!ok) printLog('warning', 'SESSION_ID restore failed — will pair fresh');
    await delay(1000);
  }

  const { version }          = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  const saveCreds_ = async () => {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    await saveCreds();
  };

  const sock = makeWASocket({
    version,
    logger,
    browser: Browsers.macOS('Chrome'),
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
    },
    msgRetryCounterCache: msgRetryCache,
    markOnlineOnConnect:         true,
    generateHighQualityLinkPreview: true,
    syncFullHistory:              false,
    defaultQueryTimeoutMs:        60_000,
    connectTimeoutMs:             60_000,
    keepAliveIntervalMs:          10_000,
    getMessage: async (key) => {
      return undefined;
    },
  });

  // ── Pairing code (runs once, 3 s after socket is created) ──────────────────
  const isRegistered = state.creds?.registered === true;

  if (!useQR && !isRegistered) {
    setTimeout(async () => {
      await doPairing(sock, state);
    }, 3000);
  }

  // ── Credential save ─────────────────────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds_);

  // ── Connection state ────────────────────────────────────────────────────────
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && useQR) {
      try {
        console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
      } catch {
        console.log('QR:', qr);
      }
    }

    if (connection === 'open') {
      printLog('success', `Connected as ${sock.user?.name} (${sock.user?.id?.split(':')[0]})`);
      printLog('success', `${config.BOT_NAME} is online!`);
      setConnected(true);
      if (rl && !rlClosed) { rl.close(); rl = null; }
      if (config.AUTO_BIO) startAutoBio(sock);
    }

    if (connection === 'close') {
      setConnected(false);
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason[code] || code;
      printLog('warning', `Disconnected: ${reason}`);

      const shouldReconnect =
        code !== DisconnectReason.loggedOut &&
        code !== DisconnectReason.multideviceMismatch &&
        code !== 401;

      if (shouldReconnect) {
        printLog('info', 'Reconnecting in 5 s...');
        await delay(5000);
        connectToWhatsApp();
      } else {
        printLog('error', 'Logged out. Delete the session folder and restart to re-pair.');
      }
    }
  });

  // ── Messages ─────────────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      if (chatUpdate.type !== 'notify') return;
      const msg = chatUpdate.messages[0];
      if (!msg?.message) return;

      // Unwrap ephemeral wrapper
      msg.message =
        Object.keys(msg.message)[0] === 'ephemeralMessage'
          ? msg.message.ephemeralMessage.message
          : msg.message;

      // Status broadcast — auto-view
      if (msg.key?.remoteJid === 'status@broadcast') {
        await autostatus.handle(sock, msg);
        return;
      }

      // Store for anti-delete / anti-edit
      antidelete.storeMessage(msg);
      antiedit.storeMessage(msg);

      // Baileys 7.x delivers edits as protocolMessage type 14 inside upsert
      await handleEditUpsert(sock, msg);

      // Store view-once references
      storeViewOnce(msg);

      const text   = getMessageText(msg);
      const parsed = text ? parseCommand(text, config.PREFIX) : null;

      // ── Commands ──────────────────────────────────────────────────────────
      if (parsed) {
        const { command } = parsed;

        // ── General ───────────────────────────────────────────────────────
        if (command === 'help' || command === 'menu') {
          await sendHelp(sock, msg);
          return;
        }
        if (command === 'ping') {
          await reply(sock, msg, '🏓 Pong! Bot is alive.');
          return;
        }
        if (command === 'status') {
          await sendStatus(sock, msg);
          return;
        }
        if (['restart', 'reboot'].includes(command)) {
          if (!isOwner(msg)) { await reply(sock, msg, '❌ Owner only.'); return; }
          await reply(sock, msg, '🔄 Restarting... session preserved.');
          setTimeout(() => process.exit(0), 2000);
          return;
        }

        // ── Plugin toggles ────────────────────────────────────────────────
        if (await handleAntiDeleteCommand(sock, msg, parsed)) return;
        if (await handleAntiEditCommand(sock, msg, parsed)) return;
        if (await handleAutoStatusCommand(sock, msg, parsed)) return;
        if (await handleAntiViewOnceCommand(sock, msg, parsed)) return;

        // ── Feature commands ──────────────────────────────────────────────
        if (await handleAICommand(sock, msg, parsed)) return;
        if (await handleSetBio(sock, msg, parsed)) return;
        if (await handleSetDp(sock, msg, parsed)) return;
        if (await handleTikTok(sock, msg, parsed)) return;
        if (await handleShazam(sock, msg, parsed)) return;
        if (await handleUpdate(sock, msg, parsed)) return;
        if (await handleVV(sock, msg, parsed)) return;
        if (await handleGetDp(sock, msg, parsed)) return;
      }

      // ── AI auto-reply ─────────────────────────────────────────────────
      if (config.AI_ENABLED) await handleAIReply(sock, msg);

    } catch (err) {
      console.error('[Message handler]', err.message);
    }
  });

  // ── Message deletions ──────────────────────────────────────────────────────
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      await antidelete.handleDelete(sock, update);
      await antiedit.handleEdit(sock, update);
    }
  });

  return sock;
}

// ─── Pairing (proven approach, Trailer identity) ──────────────────────────────
async function doPairing(sock, state, attempt = 1) {
  try {
    let phoneInput = config.PAIRING_NUMBER;

    if (!phoneInput) {
      if (rl && !rlClosed) {
        phoneInput = await question(
          chalk.bgBlack(chalk.greenBright(
            `\n📱 Enter your WhatsApp number (country code, no + or spaces)\n` +
            `   Example: 256706106326\n» `
          ))
        );
      } else {
        phoneInput = config.OWNER_NUMBER;
        printLog('info', `No console input — using OWNER_NUMBER as pairing target`);
      }
    }

    phoneInput = phoneInput.replace(/\D/g, '');

    const pn = parsePhoneNumber(`+${phoneInput}`);
    if (!pn.valid) {
      printLog('error', `Invalid phone number "${phoneInput}". Include country code, no leading zero.`);
      if (rl && !rlClosed) rl.close();
      process.exit(1);
    }

    printLog('info', `Requesting pairing code for ...${phoneInput.slice(-4)}`);
    let code = await sock.requestPairingCode(phoneInput);
    code = code?.match(/.{1,4}/g)?.join('-') || code;

    printLog('success', `Pairing code: ${chalk.greenBright.bold(code)}`);
    console.log(chalk.gray('\nOpen WhatsApp → Linked Devices → Link a device → Link with phone number instead\n'));

    if (rl && !rlClosed) { rl.close(); rl = null; }

  } catch (err) {
    printLog('error', `Pairing attempt ${attempt}/3 failed: ${err.message}`);

    if (attempt < 3) {
      try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch (_) {}
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      printLog('info', 'Cleared session — restarting connection for a fresh pairing attempt...');
      await delay(3000);
      connectToWhatsApp();
    } else {
      printLog('error', 'All 3 pairing attempts failed. Restart the bot and try again.');
    }
  }
}

// ─── Status overview ──────────────────────────────────────────────────────────
async function sendStatus(sock, msg) {
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return; }
  const p = config.PREFIX;
  const text =
    `╔══════════════════════════╗\n` +
    `║  📊 Plugin Status         ║\n` +
    `╚══════════════════════════╝\n\n` +
    `🛡️ Anti-Delete:    ${config.ANTI_DELETE    ? '🟢 ON' : '🔴 OFF'}\n` +
    `✏️ Anti-Edit:      ${config.ANTI_EDIT      ? '🟢 ON' : '🔴 OFF'}\n` +
    `👁️ Anti View-Once: ${config.ANTI_VIEW_ONCE ? '🟢 ON' : '🔴 OFF'}\n` +
    `📺 Auto Status:    ${config.AUTO_STATUS_VIEW ? '🟢 ON' : '🔴 OFF'}\n` +
    `🤖 AI Reply:       ${config.AI_ENABLED ? (config.AI_API_KEY ? '🟢 ON' : '⚠️ No API key') : '🔴 OFF'}\n` +
    `📝 Auto Bio:       ${config.AUTO_BIO ? '🟢 ON' : '🔴 OFF'}\n\n` +
    `_Use ${p}antidelete / ${p}antiedit / ${p}autostatus / ${p}antiviewonce / ${p}aionall to toggle_`;
  await reply(sock, msg, text);
}

// ─── Help menu ────────────────────────────────────────────────────────────────
async function sendHelp(sock, msg) {
  const p = config.PREFIX;
  const text =
    `╔══════════════════════════╗\n` +
    `║  🤖 ${config.BOT_NAME.padEnd(20)} ║\n` +
    `╚══════════════════════════╝\n\n` +
    `*📥 DOWNLOADER*\n` +
    `▸ ${p}tiktok <url> — TikTok video\n` +
    `▸ ${p}tiktokaudio <url> — TikTok audio\n` +
    `▸ ${p}shazam — Identify song (reply to audio)\n\n` +
    `*🛡️ PROTECTION (owner toggles)*\n` +
    `▸ ${p}antidelete on/off — Anti-delete alert\n` +
    `▸ ${p}antiedit on/off — Anti-edit alert\n` +
    `▸ ${p}antiviewonce on/off — Save view-once media\n` +
    `▸ ${p}vv — Reveal saved view-once media\n` +
    `▸ ${p}autostatus on/off — Auto-view statuses\n\n` +
    `*🤖 AI REPLY (owner toggles)*\n` +
    `▸ ${p}aionall — AI ON for all DM chats\n` +
    `▸ ${p}aialloff — AI OFF for all chats\n` +
    `▸ ${p}aion — AI ON for this chat only\n` +
    `▸ ${p}aioff — AI OFF for this chat only\n` +
    `▸ ${p}aistatus — Show AI status\n\n` +
    `*👤 PROFILE*\n` +
    `▸ ${p}setbio <text> — Set your bio\n` +
    `▸ ${p}autobio on/off — Auto gangster quotes bio\n` +
    `▸ ${p}quotebio — Set random gangster quote as bio\n` +
    `▸ ${p}setdp — Set profile pic (attach or reply to image)\n` +
    `▸ ${p}getdp @user — Get someone's profile pic\n\n` +
    `*⚙️ SYSTEM*\n` +
    `▸ ${p}status — Show all plugin on/off status\n` +
    `▸ ${p}update — Pull latest updates from GitHub\n` +
    `▸ ${p}restart — Restart bot (session preserved)\n` +
    `▸ ${p}ping — Check if bot is alive\n\n` +
    `_All toggle commands are owner-only 🔒_`;

  await reply(sock, msg, text);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.green.bold('\n╔══════════════════════════════════╗'));
  console.log(chalk.green.bold(`║  🤖 ${config.BOT_NAME.padEnd(28)} ║`));
  console.log(chalk.green.bold('║  Starting up...                  ║'));
  console.log(chalk.green.bold('╚══════════════════════════════════╝\n'));

  if (config.AI_ENABLED) {
    printLog('success', `AI auto-reply is ON (model: ${config.AI_MODEL})`);
  } else if (config.AI_API_KEY) {
    printLog('warning', 'AI_API_KEY found but AI_ENABLED=false — AI is off');
  } else {
    printLog('info', 'AI auto-reply is OFF (no AI_API_KEY set)');
  }

  startServer();
  await connectToWhatsApp();
}

process.on('uncaughtException',  err => { printLog('error', `Uncaught: ${err.message}`); console.error(err.stack); });
process.on('unhandledRejection', err => { printLog('error', `Unhandled: ${err?.message}`); });

main().catch(err => {
  printLog('error', err.message);
  process.exit(1);
});
