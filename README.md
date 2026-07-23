# 🤖 Trailer-UPS WhatsApp Bot

A feature-packed WhatsApp bot built with [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys).

---

## ✨ Features

| Plugin | Command | Description |
|--------|---------|-------------|
| 🗑️ Anti-Delete | AUTO | Catches & forwards deleted messages to owner |
| ✏️ Anti-Edit | AUTO | Shows original message before edits |
| 👁️ Auto Status View | AUTO | Automatically views all statuses |
| 📝 Set Bio | `.setbio` | Set your bio manually |
| 🔄 Auto Bio | `.autobio on/off` | Rotate gangster quotes every 6 hrs (Pop Smoke, 2Pac, King Von) |
| 🖼️ Set DP | `.setdp` | Set your profile picture |
| 🎵 TikTok Video | `.tiktok <url>` | Download TikTok video (no watermark) |
| 🎧 TikTok Audio | `.tiktokaudio <url>` | Download TikTok audio only |
| 🔍 Shazam | `.shazam` | Identify a song (reply to audio/video) |
| 🔓 View-Once | `.vv` | Reveal view-once photos/videos |
| 🤖 AI Reply | `.aionall` / `.aialloff` / `.aion` / `.aioff` | AI auto-reply on DM chats |
| 🔄 Update | `.update` | Pull latest code & restart (no re-pairing!) |
| ♻️ Restart | `.restart` | Restart bot (session preserved) |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/realjumason-md/Trailer-upsmd.git
cd Trailer-upsmd
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your details
```

Minimum required in `.env`:
```
OWNER_NUMBER=256706106326
PAIRING_PHONE=256706106326
```

### 3. Run

```bash
npm start
```

On first run, a **pairing code** will appear in the terminal.  
Go to **WhatsApp → Settings → Linked Devices → Link a Device → Enter code**.

Once paired, the session is saved in `auth_info_baileys/`. You won't need to pair again on restarts!

---

## ☁️ Deployment

Trailer-upsmd is a long-running WhatsApp client. Use a host that keeps the
Node.js process alive and preserves the `auth_info_baileys/` session directory.
Pairing is done directly in the hosting console: enter your WhatsApp number
when prompted, then enter the code printed in that same console.
The complete platform configurations are included in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

### Render

1. Connect this GitHub repository.
2. Let Render use `render.yaml`.
3. Set `OWNER_NUMBER`, `PAIRING_PHONE`, and any optional API keys.
4. Deploy on an always-on plan; the included disk preserves the WhatsApp session.
5. Open the service logs and enter your WhatsApp number when prompted.

### Railway

1. Connect this repository; Railway will use `railway.json` and `Dockerfile`.
2. Add `OWNER_NUMBER` and either `PAIRING_PHONE` or a paired session.
3. Add a persistent volume mounted at `/app/auth_info_baileys`.
4. Deploy and enter your WhatsApp number in the service console to pair.

### Fly.io

```bash
fly launch --no-deploy
fly volumes create trailer_session --region iad --size 1
fly secrets set OWNER_NUMBER=256706106326 PAIRING_PHONE=256706106326
fly deploy
```

The included `fly.toml` keeps the machine running and mounts the session volume.

### Heroku

Heroku can run the bot with the included `heroku.yml` and `Procfile`, but its
filesystem is not persistent. Use an external session strategy or expect to
pair again after a dyno replacement.

### Docker or a VPS

```bash
docker build -t trailer-upsmd .
docker run -d --name trailer-upsmd --restart unless-stopped \
  -p 5000:5000 \
  -v trailer-upsmd-session:/app/auth_info_baileys \
  -e OWNER_NUMBER=256706106326 \
  -e PAIRING_PHONE=256706106326 \
  trailer-upsmd
```

### Replit

Use Node.js 20, install dependencies with `npm install`, run
`npm run start:optimized`, enter your number in the console, and keep
`auth_info_baileys/` in persistent storage.

### Why Vercel is not included

Vercel functions are short-lived and do not provide a persistent local session
directory, so they cannot reliably keep the WhatsApp socket and Baileys keys
alive.

---

## 🤖 AI Reply Setup (Groq — Free)

This bot uses **Groq's free tier** — no credit card needed.

1. Go to [console.groq.com](https://console.groq.com) → sign up free → create an API key
2. Add to `.env`:
   ```
   AI_API_KEY=gsk_your_groq_key_here
   AI_MODEL=llama3-8b-8192
   AI_BASE_URL=https://api.groq.com/openai/v1
   ```
3. Use commands:
   - `.aionall` — AI on for ALL DMs
   - `.aion` — AI on for current chat only
   - `.aioff` — Exclude current chat (even if aionall is on)
   - `.aialloff` — Turn off AI everywhere

**Free Groq models you can use:**

| Model | Speed | Best for |
|-------|-------|---------|
| `llama3-8b-8192` | ⚡ Very fast | Default, casual chats |
| `llama-3.1-8b-instant` | ⚡ Fastest | Quick replies |
| `llama3-70b-8192` | 🧠 Smarter | Complex conversations |
| `mixtral-8x7b-32768` | 📚 Large context | Long threads |
| `gemma2-9b-it` | ✅ Balanced | General use |

---

## ♻️ Update & Redeploy

```
.update    — Pull latest code from GitHub and restart (session preserved, no re-pairing)
.restart   — Restart bot only (session preserved)
.redeploy  — Same as .update
```

The session is stored in `auth_info_baileys/` and **survives all restarts and updates**.

---

## 📋 All Commands

```
.help / .menu      — Show this menu
.ping              — Check bot latency

.setbio <text>     — Set bio
.autobio on/off    — Auto gangster quote bio (every 6 hrs)
.quotebio          — Set random gangster quote now
.setdp             — Set profile picture (attach or reply to image)

.tiktok <url>      — TikTok video
.tiktokaudio <url> — TikTok audio
.shazam            — Song recognition (reply to audio)
.vv                — Reveal view-once media

.aionall           — AI on for ALL DMs
.aialloff          — AI off everywhere
.aion              — AI on this chat
.aioff             — AI off this chat

.update            — Update bot from GitHub
.restart           — Restart bot
```

---

## ⚙️ Environment Variables

| Key | Default | Description |
|-----|---------|-------------|
| `OWNER_NUMBER` | `256706106326` | Your WhatsApp number |
| `PAIRING_METHOD` | `phone` | `phone` or `qr` |
| `PAIRING_PHONE` | `256706106326` | Number for pairing code |
| `BOT_NAME` | `Trailer-UPS BOT` | Bot display name |
| `PREFIX` | `.` | Command prefix |
| `AUTO_BIO` | `true` | Auto rotate bio every 6h |
| `AUTO_STATUS_VIEW` | `true` | Auto view statuses |
| `ANTI_DELETE` | `true` | Show deleted messages |
| `ANTI_EDIT` | `true` | Show edited messages |
| `ANTI_DELETE_SEND_TO` | `owner` | Where to send: `owner` or `same_chat` |
| `AI_API_KEY` | `` | OpenAI/compatible API key |
| `AI_MODEL` | `gpt-3.5-turbo` | AI model name |
| `AI_BASE_URL` | `https://api.openai.com/v1` | API base URL |
| `PORT` | `3000` | Express server port |
| `LOG_LEVEL` | `silent` | `silent`, `info`, `debug` |

---

## 🔒 Security

- Only the owner number can use admin commands
- Session credentials are stored locally and never transmitted
- View-once media is only sent back to the requester

---

Made with ❤️ by realjumason-md
