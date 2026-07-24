/**
 * AI AUTO-REPLY — MEGA-MD free multi-API + optional Groq/OpenAI fallback
 * Based on MEGA-MD's ai-gpt.js / ai-llama.js / ai-mistral.js
 *
 * Works WITHOUT any API key using three free GlobalTechInfo worker APIs.
 * If AI_API_KEY / GROQ_API_KEY is set, Groq/OpenAI is tried first, then
 * falls back to the free workers automatically.
 *
 * Toggle hierarchy (highest priority first):
 *   1. chatAiOff  — explicit per-chat OFF  (beats global ON)
 *   2. chatAiOn   — explicit per-chat ON   (beats global OFF)
 *   3. globalAiOn — global default (applies to DMs only)
 *
 * Commands:
 *   aionall  → globalAiOn=true,  clear chatAiOff (individual on-overrides kept)
 *   aialloff → globalAiOn=false, clear chatAiOn  (individual off-exclusions kept)
 *   aion     → add to chatAiOn,  remove from chatAiOff  (beats any global state)
 *   aioff    → add to chatAiOff, remove from chatAiOn   (beats any global state)
 */

import axios from 'axios';
import config from '../config.js';
import { isOwner, reply, getMessageText, isDM } from '../lib/utils.js';

// ── Free worker APIs (MEGA-MD, no key required) ───────────────────────────────
const FREE_APIS = [
  (q) => `https://mistral.stacktoy.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
  (q) => `https://llama.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
  (q) => `https://mistral.gtech-apiz.workers.dev/?apikey=Suhail&text=${encodeURIComponent(q)}`,
];

async function askFreeAI(query) {
  for (const apiUrl of FREE_APIS) {
    try {
      const { data } = await axios.get(apiUrl(query), { timeout: 15000 });
      const response = data?.data?.response;
      if (response && typeof response === 'string' && response.trim()) {
        return response.trim();
      }
    } catch {
      continue;
    }
  }
  throw new Error('All free AI APIs failed');
}

// ── State ─────────────────────────────────────────────────────────────────────
let globalAiOn = true;   // default: ON for DMs
const chatAiOn  = new Set(); // explicit per-chat ON  (overrides global OFF)
const chatAiOff = new Set(); // explicit per-chat OFF (overrides global ON)

const histories = new Map();

function getHistory(jid) {
  if (!histories.has(jid)) histories.set(jid, []);
  return histories.get(jid);
}

function pushHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  if (h.length > 40) h.splice(0, 2);
}

// ── API call ───────────────────────────────────────────────────────────────────
async function callAI(jid, userText) {
  if (config.AI_API_KEY) {
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
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) { pushHistory(jid, 'assistant', text); return text; }
    } catch (err) {
      console.error('[AI] Groq failed, switching to free APIs:', err.message);
    }
  }

  const answer = await askFreeAI(userText);
  pushHistory(jid, 'assistant', answer);
  return answer;
}

function typingDelay(text) {
  return Math.min(3000, Math.max(500, (text.length / 5) * (60000 / 3600)));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Should AI reply to this message? ─────────────────────────────────────────
//
//  Priority (highest first):
//   chatAiOff has jid → NO  (explicit exclusion beats everything)
//   chatAiOn  has jid → YES (explicit inclusion beats global OFF)
//   globalAiOn && isDM → YES
//   else → NO
//
function isAiActive(jid, msg) {
  if (chatAiOff.has(jid)) return false;   // explicit OFF wins
  if (chatAiOn.has(jid))  return true;    // explicit ON wins
  return globalAiOn && isDM(msg);         // fall back to global (DMs only)
}

// ── Auto-reply handler ─────────────────────────────────────────────────────────
export async function handleAIReply(sock, msg) {
  const jid = msg.key.remoteJid;
  if (!isAiActive(jid, msg)) return;
  if (msg.key.fromMe) return;

  const text = getMessageText(msg);
  if (!text) return;

  try {
    await sock.sendMessage(jid, { react: { text: '🤖', key: msg.key } });
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

  const toggleCmds = ['aionall', 'aialloff', 'aion', 'aioff', 'aistatus'];
  const queryCmds  = ['ai', 'ask', 'gpt'];
  if (![...toggleCmds, ...queryCmds].includes(command)) return false;

  // ── Direct AI query (anyone can use) ──────────────────────────────────────
  if (queryCmds.includes(command)) {
    const query = parsed.body.trim();
    if (!query) {
      await reply(sock, msg, `🤖 *AI Assistant*\n\nUsage: ${config.PREFIX}${command} <question>\nExample: ${config.PREFIX}${command} explain black holes`);
      return true;
    }
    const jid = msg.key.remoteJid;
    try {
      await sock.sendMessage(jid, { react: { text: '🤖', key: msg.key } });
      const answer = await callAI(jid, query);
      await reply(sock, msg, answer);
    } catch (err) {
      await reply(sock, msg, `❌ AI failed: ${err.message}`);
    }
    return true;
  }

  // ── Toggle commands (owner only) ──────────────────────────────────────────
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  const jid = msg.key.remoteJid;

  if (command === 'aionall') {
    // Enable AI globally for all DMs.
    // Clear chatAiOff so previously excluded chats are re-included.
    // Keep chatAiOn — those overrides are harmless and a user might re-use them.
    globalAiOn = true;
    chatAiOff.clear();
    await reply(sock, msg,
      '🤖 *AI reply ON for all DMs.*\n' +
      'Use `' + config.PREFIX + 'aioff` in any chat to exclude it.\n\n' +
      '_Powered by free MEGA-MD APIs — no key needed._');
    return true;
  }

  if (command === 'aialloff') {
    // Disable AI globally.
    // Clear chatAiOn so previous per-chat inclusions don't linger.
    // Do NOT clear chatAiOff — those exclusions are irrelevant while global is
    // OFF, but keeping them means re-enabling with aionall can re-apply them
    // correctly. More importantly, aion can still override individually.
    globalAiOn = false;
    chatAiOn.clear();
    await reply(sock, msg,
      '🔕 *AI reply OFF globally.*\n' +
      'Use `' + config.PREFIX + 'aion` in a specific chat to re-enable it there.');
    return true;
  }

  if (command === 'aion') {
    // Force AI ON for this chat, regardless of global state.
    chatAiOff.delete(jid);
    chatAiOn.add(jid);
    await reply(sock, msg, '🤖 *AI reply ON for this chat.*\n_(overrides global setting)_');
    return true;
  }

  if (command === 'aioff') {
    // Force AI OFF for this chat, regardless of global state.
    chatAiOn.delete(jid);
    chatAiOff.add(jid);
    await reply(sock, msg, '🔕 *AI reply OFF for this chat.*\n_(overrides global setting)_');
    return true;
  }

  if (command === 'aistatus') {
    const backend  = config.AI_API_KEY
      ? `✅ Groq key set (${config.AI_MODEL}) + free fallback`
      : '🆓 Free MEGA-MD APIs (no key needed)';
    const globalStatus = globalAiOn ? '🟢 ON (all DMs)' : '🔴 OFF globally';
    const excluded = chatAiOff.size ? `\n🚫 Excluded chats: ${chatAiOff.size}` : '';
    const forced   = chatAiOn.size  ? `\n✅ Force-on chats: ${chatAiOn.size}` : '';
    await reply(sock, msg,
      `🤖 *AI Status*\n` +
      `Global: ${globalStatus}${excluded}${forced}\n` +
      `Backend: ${backend}\n\n` +
      `_Priority: per-chat aioff > per-chat aion > global_`);
    return true;
  }

  return false;
}

export function getAIStatus() {
  return { globalAiOn, chatAiOn: [...chatAiOn], chatAiOff: [...chatAiOff] };
}
