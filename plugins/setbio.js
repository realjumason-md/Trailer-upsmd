/**
 * SET BIO / AUTO BIO — set profile status text
 * Based on MEGA-MD's setbio.js
 *
 * Key improvements:
 *  - Fetches fresh quotes from GlobalTechInfo GitHub databases (thousands of quotes)
 *  - Supports custom bio template with {quote} placeholder
 *  - Rotates every 10 minutes
 *  - Falls back to local lib/quotes.js when network unavailable
 */

import axios from 'axios';
import config from '../config.js';
import { isOwner, reply } from '../lib/utils.js';
import { getRandomQuote } from '../lib/quotes.js';

const QUOTE_URLS = [
  'https://raw.githubusercontent.com/GlobalTechInfo/Islamic-Database/main/text/random_quotes.txt',
  'https://raw.githubusercontent.com/GlobalTechInfo/Islamic-Database/main/text/motivational_quotes.txt',
  'https://raw.githubusercontent.com/GlobalTechInfo/Islamic-Database/main/text/pickup_quotes.txt',
];

let cachedQuotes  = [];
let lastFetchTime = 0;
const CACHE_TTL   = 60 * 60 * 1000; // 1 hour

async function fetchQuotes() {
  if (cachedQuotes.length > 0 && Date.now() - lastFetchTime < CACHE_TTL) {
    return cachedQuotes;
  }
  const all = [];
  for (const url of QUOTE_URLS) {
    try {
      const { data } = await axios.get(url, { timeout: 10000 });
      const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      all.push(...lines);
    } catch {}
  }
  if (all.length > 0) {
    cachedQuotes  = all;
    lastFetchTime = Date.now();
  }
  return cachedQuotes.length > 0 ? cachedQuotes : null;
}

function pickQuote(quotes) {
  if (quotes && quotes.length > 0) {
    return quotes[Math.floor(Math.random() * quotes.length)];
  }
  return getRandomQuote();
}

let autoBioInterval   = null;
let customBioTemplate = null;

async function setRandomBio(sock) {
  try {
    const quotes = await fetchQuotes();
    const q = pickQuote(quotes);
    let bio = customBioTemplate ? customBioTemplate.replace('{quote}', q) : q;
    if (bio.length > 139) bio = bio.slice(0, 136) + '...';
    await sock.updateProfileStatus(bio);
    return bio;
  } catch (err) {
    console.error('[setbio auto]', err.message);
    return null;
  }
}

export function startAutoBio(sock) {
  if (autoBioInterval) return;
  setRandomBio(sock).catch(() => {});
  autoBioInterval = setInterval(() => setRandomBio(sock), 10 * 60 * 1000);
}

export function stopAutoBio() {
  if (autoBioInterval) { clearInterval(autoBioInterval); autoBioInterval = null; }
}

export async function handleSetBio(sock, msg, parsed) {
  const { command, body, args } = parsed;

  if (!['setbio', 'autobio', 'quotebio'].includes(command)) return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  // ── .setbio ───────────────────────────────────────────────────────────────
  if (command === 'setbio') {
    if (!body) {
      await reply(sock, msg,
        `📝 *SetBio Usage*\n\n` +
        `*.setbio <text>* — set bio directly\n` +
        `*.setbio set <template>* — save template (use {quote} for random quotes)\n` +
        `*.setbio reset* — clear custom template\n\n` +
        `*Example:* .setbio set Living by: {quote}`
      );
      return true;
    }
    if (body === 'reset') {
      customBioTemplate = null;
      await reply(sock, msg, '✅ *Bio template cleared* — back to plain random quotes.');
      return true;
    }
    if (args[0] === 'set') {
      const template = args.slice(1).join(' ').trim();
      if (!template) {
        await reply(sock, msg, '❌ Usage: .setbio set <template>\nExample: .setbio set Living by: {quote}');
        return true;
      }
      customBioTemplate = template;
      await reply(sock, msg,
        `✅ *Template saved:*\n${template}\n\n` +
        `_Use .autobio on to start rotating, or .quotebio to apply once._`
      );
      return true;
    }
    try {
      const bio = body.slice(0, 139);
      await sock.updateProfileStatus(bio);
      await reply(sock, msg, `✅ *Bio set to:*\n${bio}`);
    } catch (err) {
      await reply(sock, msg, `❌ Failed: ${err.message}`);
    }
    return true;
  }

  // ── .quotebio ─────────────────────────────────────────────────────────────
  if (command === 'quotebio') {
    const bio = await setRandomBio(sock);
    if (bio) {
      await reply(sock, msg, `✅ *Bio set to:*\n_${bio}_`);
    } else {
      await reply(sock, msg, '❌ Failed to set bio. Try again.');
    }
    return true;
  }

  // ── .autobio ──────────────────────────────────────────────────────────────
  if (command === 'autobio') {
    const arg = args[0]?.toLowerCase();
    if (arg === 'on') {
      startAutoBio(sock);
      await reply(sock, msg,
        '✅ *Auto-bio ON* — rotates every 10 minutes.\n\n' +
        `_Template: ${customBioTemplate || 'random quote from GitHub DB'}_\n` +
        `_Use .setbio set {quote} | MyBot to customise._`
      );
    } else if (arg === 'off') {
      stopAutoBio();
      await reply(sock, msg, '🛑 *Auto-bio OFF.*');
    } else {
      await reply(sock, msg,
        `📝 *Auto-bio:* ${autoBioInterval ? '🟢 ON (10 min)' : '🔴 OFF'}\n` +
        `📋 *Template:* ${customBioTemplate || 'random quote'}\n\n` +
        `*.autobio on* — start rotating\n` +
        `*.autobio off* — stop\n` +
        `*.setbio set <template>* — set custom template`
      );
    }
    return true;
  }

  return false;
}
