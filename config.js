import 'dotenv/config';

const config = {
  // ── Bot identity ────────────────────────────────────────────────
  BOT_NAME:    process.env.BOT_NAME    || 'Trailer-UPS BOT',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '256706106326',
  PREFIX:      process.env.PREFIX      || '.',

  // ── Session ─────────────────────────────────────────────────────
  // SESSION_ID: base64-encoded creds.json from a paired session.
  //   Leave blank to do fresh pairing via code or QR.
  SESSION_ID:  process.env.SESSION_ID  || '',
  SESSION_DIR: process.env.SESSION_DIR || './session',

  // ── Pairing ─────────────────────────────────────────────────────
  // PAIRING_NUMBER: phone with country code, no + or spaces.
  //   When set the bot uses it automatically (no prompt needed).
  //   When blank the bot prompts in the hosting console.
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || '',

  // ── Features (default ON; set to 'false' in .env to disable) ───
  AUTO_STATUS_VIEW: process.env.AUTO_STATUS_VIEW !== 'false',
  AUTO_BIO:         process.env.AUTO_BIO         !== 'false',
  ANTI_DELETE:      process.env.ANTI_DELETE       !== 'false',
  ANTI_EDIT:        process.env.ANTI_EDIT         !== 'false',
  ANTI_VIEW_ONCE:   process.env.ANTI_VIEW_ONCE    !== 'false',
  // Where to forward deleted messages: 'owner' or 'same_chat'
  ANTI_DELETE_SEND_TO: process.env.ANTI_DELETE_SEND_TO || 'owner',

  // ── AI — auto-enabled when any AI API key is present ────────────
  // Set AI_ENABLED=false in .env to explicitly disable.
  // Supports AI_API_KEY or GROQ_API_KEY (both are accepted).
  AI_ENABLED:       process.env.AI_ENABLED !== 'false' && !!(process.env.AI_API_KEY || process.env.GROQ_API_KEY),
  AI_API_KEY:       process.env.AI_API_KEY || process.env.GROQ_API_KEY || '',
  AI_MODEL:         process.env.AI_MODEL    || 'llama3-8b-8192',
  AI_BASE_URL:      process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
  AI_SYSTEM_PROMPT: process.env.AI_SYSTEM_PROMPT || 'You are a helpful WhatsApp assistant. Reply concisely.',

  // ── GitHub (for .update command) ────────────────────────────────
  GITHUB_REPO:   process.env.GITHUB_REPO   || 'realjumason-md/Trailer-upsmd',
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',

  // ── Shazam (RapidAPI) ────────────────────────────────────────────
  // Free tier at https://rapidapi.com/search/shazam (shazam-api6 plan)
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '',

  // ── TikTok ──────────────────────────────────────────────────────
  TIKTOK_API: process.env.TIKTOK_API || 'https://www.tikwm.com/api/',

  // ── Server ──────────────────────────────────────────────────────
  PORT: Number(process.env.PORT) || 5000,
};

export default config;
