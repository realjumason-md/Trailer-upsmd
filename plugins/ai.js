/**
 * AI REPLY PLUGIN
 * Commands:
 *   .aionall    — enable AI replies on ALL DM chats
 *   .aialloff   — disable AI replies on all DM chats
 *   .aion       — enable AI on this specific chat (even if aialloff)
 *   .aioff      — disable AI on this specific chat (excludes from aionall)
 */

const axios = require('axios');
const config = require('../config');
const { isOwner, reply, isDM, getMessageText, reactTo } = require('../lib/utils');

// State
let globalAiOn = false; // aionall state
const chatAiOn = new Set();   // chats explicitly enabled
const chatAiOff = new Set();  // chats explicitly excluded (overrides aionall)

// Conversation history per chat (last 10 messages)
const histories = new Map();

function isAiEnabledForChat(jid) {
  if (chatAiOff.has(jid)) return false;      // explicitly off — always wins
  if (chatAiOn.has(jid)) return true;         // explicitly on for this chat
  return globalAiOn;                           // else follow global
}

async function askAI(jid, userMessage) {
  if (!config.AI_API_KEY) {
    return "AI is not configured. Please set AI_API_KEY in your environment.";
  }

  // Maintain per-chat history
  if (!histories.has(jid)) histories.set(jid, []);
  const history = histories.get(jid);

  history.push({ role: 'user', content: userMessage });
  if (history.length > 20) history.splice(0, 2); // keep last 10 exchanges

  const messages = [
    { role: 'system', content: config.AI_SYSTEM_PROMPT },
    ...history,
  ];

  const res = await axios.post(
    `${config.AI_BASE_URL}/chat/completions`,
    { model: config.AI_MODEL, messages, max_tokens: 512, temperature: 0.8 },
    {
      headers: {
        Authorization: `Bearer ${config.AI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const assistantReply = res.data.choices?.[0]?.message?.content || 'No response.';
  history.push({ role: 'assistant', content: assistantReply });
  return assistantReply;
}

async function handleAICommand(sock, msg, { command }) {
  const commands = ['aionall', 'aialloff', 'aion', 'aioff'];
  if (!commands.includes(command)) return false;
  if (!isOwner(msg)) {
    await reply(sock, msg, '❌ Only the bot owner can control AI settings.');
    return true;
  }

  const jid = msg.key.remoteJid;

  if (command === 'aionall') {
    globalAiOn = true;
    chatAiOff.clear(); // reset all exclusions
    await reply(sock, msg,
      `🤖 *AI replies enabled on ALL DM chats!*\n\n` +
      `Use *.aioff* in a specific chat to exclude it.\n` +
      `Use *.aialloff* to turn off globally.`
    );
    return true;
  }

  if (command === 'aialloff') {
    globalAiOn = false;
    chatAiOn.clear();
    chatAiOff.clear();
    await reply(sock, msg, '🔕 *AI replies disabled on ALL chats.*');
    return true;
  }

  if (command === 'aion') {
    chatAiOff.delete(jid); // remove from exclusions
    chatAiOn.add(jid);
    await reply(sock, msg,
      `🤖 *AI replies ON for this chat!*\n` +
      `_This chat is enabled even if global AI is off._`
    );
    return true;
  }

  if (command === 'aioff') {
    chatAiOn.delete(jid);
    chatAiOff.add(jid); // explicitly exclude this chat
    await reply(sock, msg,
      `🔕 *AI replies OFF for this chat.*\n` +
      `_This chat is excluded even if aionall is active._`
    );
    return true;
  }

  return false;
}

async function handleAIReply(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;
  if (!isDM(msg)) return; // only DMs

  const jid = msg.key.remoteJid;
  if (!isAiEnabledForChat(jid)) return;

  const text = getMessageText(msg);
  if (!text || text.startsWith(config.PREFIX)) return;

  try {
    await sock.sendPresenceUpdate('composing', jid);
    const aiReply = await askAI(jid, text);
    await sock.sendPresenceUpdate('paused', jid);
    await sock.sendMessage(jid, { text: aiReply }, { quoted: msg });
  } catch (err) {
    console.error('[AI] Error:', err.message);
  }
}

function getAIStatus() {
  return {
    globalAiOn,
    chatAiOn: [...chatAiOn],
    chatAiOff: [...chatAiOff],
  };
}

module.exports = { handleAICommand, handleAIReply, getAIStatus };
