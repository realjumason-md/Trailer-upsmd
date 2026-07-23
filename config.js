require('dotenv').config();

module.exports = {
  // Bot owner WhatsApp number (no + or spaces, with country code)
  OWNER_NUMBER: process.env.OWNER_NUMBER || '256706106326',

  // Command prefix
  PREFIX: process.env.PREFIX || '.',

  // Bot display name
  BOT_NAME: process.env.BOT_NAME || 'Trailer-UPS BOT',

  // Session directory
  SESSION_DIR: process.env.SESSION_DIR || './auth_info_baileys',

  // Pairing method: 'phone' or 'qr'
  PAIRING_METHOD: process.env.PAIRING_METHOD || 'phone',

  // Phone number for pairing code (with country code, no +)
  PAIRING_PHONE: process.env.PAIRING_PHONE || '256706106326',

  // Auto status view
  AUTO_STATUS_VIEW: process.env.AUTO_STATUS_VIEW !== 'false',

  // Bio rotation (every 6 hours)
  AUTO_BIO: process.env.AUTO_BIO !== 'false',

  // Express server port
  PORT: process.env.PORT || 5000,

  // AI settings — Groq free tier by default
  AI_ENABLED: process.env.AI_ENABLED === 'true',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'llama3-8b-8192',
  AI_BASE_URL: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
  AI_SYSTEM_PROMPT: process.env.AI_SYSTEM_PROMPT || 'You are a helpful WhatsApp assistant. Reply concisely.',

  // GitHub repo for update plugin
  GITHUB_REPO: process.env.GITHUB_REPO || 'realjumason-md/Trailer-upsmd',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',

  // Anti-delete / anti-edit settings
  ANTI_DELETE: process.env.ANTI_DELETE !== 'false',
  ANTI_EDIT: process.env.ANTI_EDIT !== 'false',
  ANTI_DELETE_SEND_TO: process.env.ANTI_DELETE_SEND_TO || 'owner', // 'owner' or 'same_chat'

  // Anti-view-once
  ANTI_VIEW_ONCE: process.env.ANTI_VIEW_ONCE !== 'false',

  // TikTok API
  TIKTOK_API: process.env.TIKTOK_API || 'https://www.tikwm.com/api/',
};
