/**
 * AI REPLY PLUGIN — HUMAN MODE
 * Replies like a real person. No one should detect it's a bot.
 *
 * Commands (owner only):
 *   .aionall    — enable AI on ALL DM chats
 *   .aialloff   — disable AI on all DM chats
 *   .aion       — enable AI on this specific chat
 *   .aioff      — disable AI on this specific chat (excluded even from aionall)
 */

const axios = require('axios');
const config = require('../config');
const { isOwner, reply, isDM, getMessageText } = require('../lib/utils');

// ─── State ───────────────────────────────────────────────────────────────────
let globalAiOn = false;
const chatAiOn  = new Set();  // explicitly enabled
const chatAiOff = new Set();  // explicitly excluded (wins over everything)

// Per-chat conversation history (max 30 turns so context stays rich)
const histories = new Map();

// Per-chat "last seen" tracking — rotate naturally so sender sees "online" bursts
const lastTyping = new Map();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAiEnabledForChat(jid) {
  if (chatAiOff.has(jid)) return false;
  if (chatAiOn.has(jid))  return true;
  return globalAiOn;
}

/** Random integer between min and max (inclusive) */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Delay that scales with reply length — feels like real typing speed */
function typingDelay(text) {
  // Average human types ~40 wpm ≈ 200 chars/min
  const baseMs = Math.min(text.length * 50, 6000); // cap at 6 s
  const jitter  = randInt(-400, 800);
  return Math.max(800, baseMs + jitter);
}

/** Occasionally add human-like filler at the start (not every message) */
function maybeAddFiller() {
  const fillers = [
    '', '', '', '', '', '',           // mostly nothing
    'lol ',
    'haha ',
    'wait, ',
    'ok so ',
    'hmm, ',
    'yeah, ',
    'nah, ',
    'tbh ',
    'fr tho, ',
    'idk, ',
    'bro, ',
  ];
  return fillers[randInt(0, fillers.length - 1)];
}

/** Occasionally add a casual sign-off or trailing reaction */
function maybeAddTrailer() {
  const trailers = [
    '', '', '', '', '', '', '',       // mostly nothing
    ' lol',
    ' fr',
    ' tho',
    ' tbh',
    ' ngl',
    ' 😂',
    ' 🙃',
    ' 💀',
    ' 🤷',
    ' bruh',
  ];
  return trailers[randInt(0, trailers.length - 1)];
}

/**
 * Humanise the raw AI reply:
 * - strip any "As an AI…" openers
 * - lowercase first letter sometimes
 * - occasionally drop a period at the end
 * - shorten if too long
 */
function humanise(text) {
  let t = text.trim();

  // Strip common AI tells
  const aiTells = [
    /^(as an ai( language model)?[,:]?\s*)/i,
    /^(i('m| am) (just )?an ai[,:]?\s*)/i,
    /^(i don't have (personal )?(feelings|emotions|opinions)[,.]?\s*)/i,
    /^(of course[,!]?\s*)/i,
    /^(certainly[,!]?\s*)/i,
    /^(sure[,!]?\s*)/i,
    /^(great question[,!]?\s*)/i,
    /^(absolutely[,!]?\s*)/i,
    /^(i('d| would) be happy to help[,!]?\s*)/i,
  ];
  for (const re of aiTells) {
    t = t.replace(re, '');
  }

  // Trim again after stripping
  t = t.trim();

  // Randomly lowercase the first character (~30% chance)
  if (randInt(0, 9) < 3 && t.length > 0) {
    t = t[0].toLowerCase() + t.slice(1);
  }

  // Randomly drop trailing period (~40% chance)
  if (randInt(0, 9) < 4 && t.endsWith('.')) {
    t = t.slice(0, -1);
  }

  // Occasionally strip markdown bold/italic that feels robotic
  t = t.replace(/\*\*(.*?)\*\*/g, '$1');
  t = t.replace(/__(.*?)__/g, '$1');

  // Add casual prefix and suffix sometimes
  t = maybeAddFiller() + t + maybeAddTrailer();

  return t;
}

// ─── AI API call ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are replying as the phone owner in a WhatsApp conversation. You are NOT an AI assistant — you are that person.

Rules you must follow:
- Write exactly like a real human texting: casual, short, sometimes incomplete sentences.
- Use lowercase most of the time. Use capitals only for emphasis occasionally.
- Use abbreviations naturally: lol, fr, ngl, tbh, idk, nah, bruh, bro, omg, imo, etc.
- Vary your sentence lengths — sometimes one word, sometimes a full sentence. Never a wall of text.
- Never say "As an AI", "I'm an AI", "I don't have feelings", or any variation.
- Have opinions. Be opinionated, direct, a little cheeky sometimes.
- If asked something personal (how are you, what are you doing, etc.) give a casual real-sounding answer.
- If asked something you genuinely don't know, say "idk" or "not sure tbh" like a human would.
- Never use bullet points or numbered lists — humans don't text like that.
- Don't greet with "Hello!" or "Hi there!" unless the other person greeted first.
- React with emojis naturally, but don't overdo it — 0 or 1 emoji per message usually.
- Keep replies short unless the topic clearly calls for more.
- Don't repeat the question back. Just answer or react.
- The conversation history is your memory. Stay consistent with what you said before.
`.trim();

async function callAI(jid, userMessage) {
  if (!config.AI_API_KEY) return null;

  if (!histories.has(jid)) histories.set(jid, []);
  const history = histories.get(jid);

  history.push({ role: 'user', content: userMessage });

  // Keep last 30 turns (15 exchanges)
  if (history.length > 30) history.splice(0, 2);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
  ];

  const res = await axios.post(
    `${config.AI_BASE_URL}/chat/completions`,
    {
      model:       config.AI_MODEL,
      messages,
      max_tokens:  350,      // keep replies short and natural
      temperature: 0.95,     // high variance = less robotic
      presence_penalty: 0.6, // don't repeat yourself
      frequency_penalty: 0.5,
    },
    {
      headers: {
        Authorization: `Bearer ${config.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const raw = res.data.choices?.[0]?.message?.content || '';
  const reply = humanise(raw);

  history.push({ role: 'assistant', content: reply });
  return reply;
}

// ─── Main reply handler ───────────────────────────────────────────────────────

async function handleAIReply(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;
  if (!isDM(msg)) return; // DMs only

  const jid = msg.key.remoteJid;
  if (!isAiEnabledForChat(jid)) return;

  const text = getMessageText(msg);
  if (!text || text.startsWith(config.PREFIX)) return;

  try {
    // ── 1. Read receipt — looks like we read the message ──────────────────
    await sock.readMessages([msg.key]);

    // ── 2. Short "read but not typing yet" pause (0.5 – 2 s) ─────────────
    await new Promise(r => setTimeout(r, randInt(500, 2000)));

    // ── 3. Call AI while showing "online" presence ────────────────────────
    const aiText = await callAI(jid, text);
    if (!aiText) return;

    // ── 4. Show typing indicator for as long as it would take to type ─────
    await sock.sendPresenceUpdate('available', jid);
    await new Promise(r => setTimeout(r, randInt(300, 700)));
    await sock.sendPresenceUpdate('composing', jid);

    const delay = typingDelay(aiText);
    await new Promise(r => setTimeout(r, delay));

    // ── 5. Send the message ───────────────────────────────────────────────
    await sock.sendPresenceUpdate('paused', jid);
    await sock.sendMessage(jid, { text: aiText }, { quoted: msg });

    // ── 6. Go back "offline" after a natural delay (feels like you put  ───
    //       the phone down after replying)
    const offlineDelay = randInt(8000, 25000);
    setTimeout(async () => {
      try {
        await sock.sendPresenceUpdate('unavailable', jid);
      } catch {}
    }, offlineDelay);

  } catch (err) {
    console.error('[AI] Error:', err.message);
  }
}

// ─── Command handler ──────────────────────────────────────────────────────────

async function handleAICommand(sock, msg, { command }) {
  const cmds = ['aionall', 'aialloff', 'aion', 'aioff'];
  if (!cmds.includes(command)) return false;
  if (!isOwner(msg)) {
    await reply(sock, msg, '❌ Only the bot owner can control AI settings.');
    return true;
  }

  const jid = msg.key.remoteJid;

  if (command === 'aionall') {
    globalAiOn = true;
    chatAiOff.clear();
    await reply(sock, msg,
      `🤖 *AI reply ON for all DM chats*\n\n` +
      `The bot will reply like a human — typing indicators, read receipts, natural delays.\n` +
      `Use *.aioff* in any chat to exclude it.\n` +
      `Use *.aialloff* to turn off globally.`
    );
    return true;
  }

  if (command === 'aialloff') {
    globalAiOn = false;
    chatAiOn.clear();
    chatAiOff.clear();
    await reply(sock, msg, '🔕 *AI reply OFF on all chats.*');
    return true;
  }

  if (command === 'aion') {
    chatAiOff.delete(jid);
    chatAiOn.add(jid);
    await reply(sock, msg,
      `🤖 *AI reply ON for this chat.*\n_Active even if global AI is off._`
    );
    return true;
  }

  if (command === 'aioff') {
    chatAiOn.delete(jid);
    chatAiOff.add(jid);
    await reply(sock, msg,
      `🔕 *AI reply OFF for this chat.*\n_Excluded even if aionall is active._`
    );
    return true;
  }

  return false;
}

function getAIStatus() {
  return {
    globalAiOn,
    chatAiOn:  [...chatAiOn],
    chatAiOff: [...chatAiOff],
  };
}

module.exports = { handleAICommand, handleAIReply, getAIStatus };
