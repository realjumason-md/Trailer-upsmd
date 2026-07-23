/**
 * SET BIO / AUTO BIO — set profile status text
 */

import config from '../config.js';
import { isOwner, reply } from '../lib/utils.js';
import { getRandomQuote } from '../lib/quotes.js';

let autoBioInterval = null;

export async function handleSetBio(sock, msg, parsed) {
  const { command, body } = parsed;

  if (!['setbio', 'autobio', 'quotebio'].includes(command)) return false;
  if (!isOwner(msg)) {
    await reply(sock, msg, '🔒 Owner only.');
    return true;
  }

  if (command === 'setbio') {
    if (!body) { await reply(sock, msg, '❌ Usage: .setbio <text>'); return true; }
    try {
      await sock.updateProfileStatus(body);
      await reply(sock, msg, `✅ Bio set to:\n${body}`);
    } catch (err) {
      await reply(sock, msg, `❌ Failed: ${err.message}`);
    }
    return true;
  }

  if (command === 'quotebio') {
    const q = getRandomQuote();
    try {
      await sock.updateProfileStatus(q.slice(0, 139));
      await reply(sock, msg, `✅ Bio set to random quote:\n_${q}_`);
    } catch (err) {
      await reply(sock, msg, `❌ Failed: ${err.message}`);
    }
    return true;
  }

  if (command === 'autobio') {
    const arg = parsed.args[0]?.toLowerCase();
    if (arg === 'on') {
      startAutoBio(sock);
      await reply(sock, msg, '✅ Auto-bio enabled — rotates every 6 hours.');
    } else if (arg === 'off') {
      stopAutoBio();
      await reply(sock, msg, '🛑 Auto-bio disabled.');
    } else {
      await reply(sock, msg, '❌ Usage: .autobio on | off');
    }
    return true;
  }

  return false;
}

export function startAutoBio(sock) {
  if (autoBioInterval) return;
  const rotate = async () => {
    try {
      const q = getRandomQuote().slice(0, 139);
      await sock.updateProfileStatus(q);
    } catch (_) {}
  };
  rotate();
  autoBioInterval = setInterval(rotate, 6 * 60 * 60 * 1000);
}

export function stopAutoBio() {
  if (autoBioInterval) { clearInterval(autoBioInterval); autoBioInterval = null; }
}
