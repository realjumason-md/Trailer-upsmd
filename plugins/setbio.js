/**
 * SET BIO PLUGIN
 * - Auto-rotates bio every 6 hours with gangster quotes
 * - .setbio <text> — manually set bio
 * - .autobio on/off — toggle auto bio rotation
 */

const cron = require('node-cron');
const config = require('../config');
const { getRandomQuote } = require('../lib/quotes');
const { isOwner, reply } = require('../lib/utils');

let autoBioEnabled = config.AUTO_BIO;
let cronJob = null;
let quoteIndex = 0;

async function rotateBio(sock) {
  try {
    const quote = getRandomQuote();
    await sock.updateProfileStatus(quote);
    console.log(`[SetBio] Bio updated: ${quote.substring(0, 60)}...`);
  } catch (err) {
    console.error('[SetBio] Failed to update bio:', err.message);
  }
}

function startAutoBio(sock) {
  if (cronJob) cronJob.destroy();
  // Every 6 hours
  cronJob = cron.schedule('0 */6 * * *', () => rotateBio(sock), {
    scheduled: true,
    timezone: 'UTC',
  });
  console.log('[SetBio] Auto bio rotation started (every 6 hours)');
  // Set immediately on start
  rotateBio(sock);
}

function stopAutoBio() {
  if (cronJob) {
    cronJob.destroy();
    cronJob = null;
  }
  console.log('[SetBio] Auto bio rotation stopped');
}

async function handleSetBio(sock, msg, { command, body }) {
  if (!isOwner(msg)) return;

  if (command === 'setbio') {
    if (!body.trim()) {
      return reply(sock, msg, '❌ Usage: .setbio <your new bio text>');
    }
    try {
      await sock.updateProfileStatus(body.trim());
      return reply(sock, msg, `✅ Bio updated to:\n\n_${body.trim()}_`);
    } catch (err) {
      return reply(sock, msg, `❌ Failed to update bio: ${err.message}`);
    }
  }

  if (command === 'autobio') {
    const arg = body.toLowerCase().trim();
    if (arg === 'on') {
      autoBioEnabled = true;
      startAutoBio(sock);
      return reply(sock, msg, '✅ Auto bio rotation *ON* — bio will change every 6 hours with gangster quotes 🔥');
    } else if (arg === 'off') {
      autoBioEnabled = false;
      stopAutoBio();
      return reply(sock, msg, '✅ Auto bio rotation *OFF*');
    } else {
      return reply(sock, msg, `📌 Auto bio is currently *${autoBioEnabled ? 'ON' : 'OFF'}*\n\nUsage: .autobio on | .autobio off`);
    }
  }

  if (command === 'quotebio') {
    // Manually trigger one quote update
    try {
      const quote = getRandomQuote();
      await sock.updateProfileStatus(quote);
      return reply(sock, msg, `✅ Bio set to random quote:\n\n_${quote}_`);
    } catch (err) {
      return reply(sock, msg, `❌ Failed: ${err.message}`);
    }
  }
}

module.exports = { handleSetBio, startAutoBio, stopAutoBio };
