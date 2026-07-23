# Trailer-UPS BOT

A WhatsApp multi-device bot built on Baileys 7.x.

## Features

- 🛡️ Anti-delete, anti-edit, anti-view-once
- 📥 TikTok video/audio downloader
- 🎵 Song identification (Shazam)
- 🤖 AI auto-reply (Groq / any OpenAI-compatible API)
- 👤 Profile pic & bio management (manual + auto-rotate)
- 📡 Auto status view
- 🔄 Self-update & restart commands

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    → Fill in OWNER_NUMBER and PAIRING_NUMBER (or leave PAIRING_NUMBER blank to be prompted)

# 3. Start
npm start
```

The bot will print a **pairing code** in the console. Open WhatsApp → Linked Devices → Link a device → Link with phone number instead → enter the code.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OWNER_NUMBER` | ✅ | Your WhatsApp number — country code, no `+` or spaces |
| `PAIRING_NUMBER` | ⬜ | Same format as above. When set, pairing is automatic (no prompt). Leave blank to be prompted in the console. |
| `SESSION_ID` | ⬜ | Base64-encoded `creds.json` — skips pairing entirely on startup |
| `SESSION_DIR` | ⬜ | Where session files are stored (default: `./session`) |
| `BOT_NAME` | ⬜ | Display name shown in help menus (default: `Trailer-UPS BOT`) |
| `PREFIX` | ⬜ | Command prefix (default: `.`) |
| `AI_ENABLED` | ⬜ | `true` to enable AI auto-reply |
| `AI_API_KEY` | ⬜ | API key — free at [console.groq.com](https://console.groq.com) |
| `AI_MODEL` | ⬜ | Model name (default: `llama3-8b-8192`) |
| `AUTO_BIO` | ⬜ | `false` to disable auto bio rotation |
| `ANTI_DELETE` | ⬜ | `false` to disable anti-delete |
| `PORT` | ⬜ | HTTP server port (default: `5000`) |

---

## Commands

| Command | Description |
|---|---|
| `.help` / `.menu` | Show all commands |
| `.ping` | Check if bot is alive |
| `.restart` | Restart bot (session preserved) |
| `.update` | Pull latest code from GitHub |
| `.setbio <text>` | Set profile status |
| `.quotebio` | Set a random gangster quote as status |
| `.autobio on/off` | Auto-rotate bio every 6 hours |
| `.setdp` | Set profile picture (attach image) |
| `.getdp @user` | Fetch someone's profile picture |
| `.tiktok <url>` | Download TikTok video |
| `.tiktokaudio <url>` | Download TikTok audio |
| `.shazam` | Identify a song (reply to audio) |
| `.vv` | Reveal a view-once message |
| `.aionall` | Enable AI reply for all DM chats |
| `.aialloff` | Disable AI reply everywhere |
| `.aion` | Enable AI reply for this chat |
| `.aioff` | Disable AI reply for this chat |

All commands marked 🔒 are owner-only.

---

## Pairing Methods

### Option A — Pairing code (default, recommended)
Set `PAIRING_NUMBER` in `.env` or leave it blank to be prompted when the bot starts.
Enter the printed code in WhatsApp → Linked Devices → Link a device → Link with phone number instead.

### Option B — QR code
```bash
node index.js --qr-code
```
Scan the QR printed in the terminal with WhatsApp.

### Option C — Session ID (zero-downtime re-deploy)
Export your `session/creds.json` as base64 and paste it as `SESSION_ID` in your hosting environment:
```bash
base64 -w0 session/creds.json
```

---

## Deployment

Works on any Node.js 20+ host: Railway, Render, Heroku, Fly.io, VPS.

```bash
# Optimised start (limits RAM to 512 MB)
npm run start:optimized
```

For platforms that kill idle processes, the built-in Express server on `PORT` acts as a keep-alive target.
