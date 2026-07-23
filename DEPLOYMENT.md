# Trailer-upsmd deployment

Trailer-upsmd is a long-running WhatsApp client. It must run as an always-on
Node.js process with persistent storage for `auth_info_baileys/`.

## Shared settings

- Start command: `npm run start:optimized`
- Node.js: 20 or newer
- Health endpoint: `/health`
- Required values: `OWNER_NUMBER` and either the web pairing flow or
  `PAIRING_PHONE`
- Session directory: `auth_info_baileys/`

After pairing, keep the session directory on persistent storage. If the host
replaces the filesystem, the bot will need to be paired again.

## Platform configuration included

| Platform | Configuration | Important setting |
| --- | --- | --- |
| Render | `render.yaml` | Uses an always-on instance and persistent disk |
| Railway | `railway.json`, `Dockerfile` | Add a persistent volume mounted at `/app/auth_info_baileys` |
| Fly.io | `fly.toml`, `Dockerfile` | Create the `trailer_session` volume before deploy |
| Heroku | `heroku.yml`, `Procfile`, `Dockerfile` | Use an external session store or expect re-pairing after dyno replacement |
| Docker | `Dockerfile` | Mount a host directory at `/app/auth_info_baileys` |
| Replit | `replit.nix` | Run `npm install && npm run start:optimized`; use persistent storage |

## Environment

```text
OWNER_NUMBER=256706106326
PAIRING_METHOD=phone
PAIRING_PHONE=256706106326
BOT_NAME=Trailer-UPS BOT
PORT=5000
AUTO_STATUS_VIEW=true
AUTO_BIO=true
ANTI_DELETE=true
ANTI_EDIT=true
LOG_LEVEL=info
```

Set `AI_API_KEY` only if AI replies are enabled.

## Why Vercel is not supported

Vercel functions are short-lived and do not provide a persistent local session
directory. They cannot reliably keep the WhatsApp socket or Baileys signal
keys alive, so the previous `vercel.json` configuration was removed.

## Local Docker example

```bash
docker build -t trailer-upsmd .
docker run -d \
  --name trailer-upsmd \
  --restart unless-stopped \
  -p 5000:5000 \
  -v trailer-upsmd-session:/app/auth_info_baileys \
  -e OWNER_NUMBER=256706106326 \
  -e PAIRING_PHONE=256706106326 \
  trailer-upsmd
```