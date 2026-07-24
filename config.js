import 'dotenv/config';

const config = {
  // ── Bot identity ────────────────────────────────────────────────
  BOT_NAME:    process.env.BOT_NAME    || 'Trailer-UPS BOT',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '256706106326',
  PREFIX:      process.env.PREFIX      || '.',

  // ── Session ─────────────────────────────────────────────────────
  SESSION_ID:  process.env.SESSION_ID  || '',
  SESSION_DIR: process.env.SESSION_DIR || './session',

  // ── Pairing ─────────────────────────────────────────────────────
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || '',

  // ── Features (default ON; set to 'false' in .env to disable) ───
  AUTO_STATUS_VIEW: process.env.AUTO_STATUS_VIEW !== 'false',
  AUTO_BIO:         process.env.AUTO_BIO         !== 'false',
  ANTI_DELETE:      process.env.ANTI_DELETE       !== 'false',
  ANTI_EDIT:        process.env.ANTI_EDIT         !== 'false',
  ANTI_VIEW_ONCE:   process.env.ANTI_VIEW_ONCE    !== 'false',
  ANTI_DELETE_SEND_TO: process.env.ANTI_DELETE_SEND_TO || 'owner',

  // ── AI ───────────────────────────────────────────────────────────
  AI_ENABLED:       process.env.AI_ENABLED !== 'false' && !!(process.env.AI_API_KEY || process.env.GROQ_API_KEY),
  AI_API_KEY:       process.env.AI_API_KEY || process.env.GROQ_API_KEY || '',
  AI_MODEL:         process.env.AI_MODEL    || 'llama3-8b-8192',
  AI_BASE_URL:      process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
  AI_SYSTEM_PROMPT: process.env.AI_SYSTEM_PROMPT || 'You are a helpful WhatsApp assistant. Reply concisely.',

  // ── GitHub (for .update command) ────────────────────────────────
  GITHUB_REPO:   process.env.GITHUB_REPO   || 'realjumason-md/Trailer-upsmd',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',

  // ── Shazam (RapidAPI) ────────────────────────────────────────────
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '',

  // ── TikTok ──────────────────────────────────────────────────────
  TIKTOK_API: process.env.TIKTOK_API || 'https://www.tikwm.com/api/',

  // ── Server ──────────────────────────────────────────────────────
  PORT: Number(process.env.PORT) || 5000,

  // ── Keep-alive (for free-tier hosting like Render / Railway) ───
  // Set KEEP_ALIVE_URL to the public URL of this bot's web server so it
  // pings itself periodically and prevents the free tier from sleeping.
  // Example: https://your-app.onrender.com
  KEEP_ALIVE_URL:      process.env.KEEP_ALIVE_URL      || '',
  // How often to self-ping, in milliseconds. Default: every 14 minutes
  // (Render free tier sleeps after 15 min of inactivity).
  KEEP_ALIVE_INTERVAL: Number(process.env.KEEP_ALIVE_INTERVAL) || 14 * 60 * 1000,
};

export default config;
