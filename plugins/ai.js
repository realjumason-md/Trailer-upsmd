/**
 * AI AUTO-REPLY — uses Groq (or any OpenAI-compatible API) to reply to DMs
 */

import axios from 'axios';
import config from '../config.js';
import { isOwner, reply, getMessageText, isDM } from '../lib/utils.js';

// ── State ─────────────────────────────────────────────────────────────────────
let globalAiOn = false;
const chatAiOn  = new Set();
const chatAiOff = new Set();

// Per-chat conversation history (max 20 turns each)
const histories = new Map();

function getHistory(jid) {
  if (!histories.has(jid)) histories.set(jid, []);
  return histories.get(jid);
}

function pushHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  if (h.length > 40) h.splice(0, 2); // drop oldest pair
}

// ── API call ───────────────────────────────────────────────────────────────────
async function callAI(jid, userText) {
  if (!config.AI_ENABLED || !config.AI_API_KEY) return null;

  pushHistory(jid, 'user', userText);

  try {
    const { data } = await axios.post(
      `${config.AI_BASE_URL}/chat/completions`,
      {
        model:    config.AI_MODEL,
        messages: [
          { role: 'system', content: config.AI_SYSTEM_PROMPT },
          ...getHistory(jid),
        ],
        max_tokens: 500,
      },
      {
        headers: { Authorization: `Bearer ${config.AI_API_KEY}` },
        timeout: 30000,
      }
    );
    const reply_ = data.choices?.[0]?.message?.content?.trim();
    if (reply_) pushHistory(jid, 'assistant', reply_);
    return reply_ || null;
  } catch (err) {
    console.error('[AI]', err.message);
    return null;
  }
}

function typingDelay(text) {
  // ~60 WPM average typing speed
  return Math.min(3000, Math.max(500, (text.length / 5) * (60000 / 3600)));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Auto-reply handler ─────────────────────────────────────────────────────────
export async function handleAIReply(sock, msg) {
  if (!config.AI_ENABLED) return;

  const jid = msg.key.remoteJid;

  const active =
    (globalAiOn && !chatAiOff.has(jid) && isDM(msg)) ||
    chatAiOn.has(jid);

  if (!active) return;
  if (msg.key.fromMe) return;

  const text = getMessageText(msg);
  if (!text) return;

  try {
    await sock.sendPresenceUpdate('available', jid);
    await new Promise(r => setTimeout(r, randInt(200, 500)));
    await sock.sendPresenceUpdate('composing', jid);

    const aiText = await callAI(jid, text);
    if (!aiText) return;

    await new Promise(r => setTimeout(r, typingDelay(aiText)));
    await sock.sendPresenceUpdate('paused', jid);
    await sock.sendMessage(jid, { text: aiText }, { quoted: msg });

    setTimeout(async () => {
      try { await sock.sendPresenceUpdate('unavailable', jid); } catch (_) {}
    }, randInt(8000, 25000));
  } catch (err) {
    console.error('[AI reply]', err.message);
  }
}

// ── Command handler ────────────────────────────────────────────────────────────
export async function handleAICommand(sock, msg, parsed) {
  const { command } = parsed;
  if (!['aionall', 'aialloff', 'aion', 'aioff'].includes(command)) return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const jid = msg.key.remoteJid;

  if (command === 'aionall') {
    globalAiOn = true; chatAiOff.clear();
    await reply(sock, msg, '🤖 *AI reply ON for all DM chats.*\nUse .aioff in any chat to exclude it.');
    return true;
  }
  if (command === 'aialloff') {
    globalAiOn = false; chatAiOn.clear(); chatAiOff.clear();
    await reply(sock, msg, '🔕 *AI reply OFF on all chats.*');
    return true;
  }
  if (command === 'aion') {
    chatAiOff.delete(jid); chatAiOn.add(jid);
    await reply(sock, msg, '🤖 *AI reply ON for this chat.*');
    return true;
  }
  if (command === 'aioff') {
    chatAiOn.delete(jid); chatAiOff.add(jid);
    await reply(sock, msg, '🔕 *AI reply OFF for this chat.*');
    return true;
  }
  return false;
}

export function getAIStatus() {
  return { globalAiOn, chatAiOn: [...chatAiOn], chatAiOff: [...chatAiOff] };
}
