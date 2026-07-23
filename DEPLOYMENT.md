# Trailer-upsmd deployment

Trailer-upsmd is a long-running WhatsApp client. It must run as an always-on
Node.js process with persistent storage for `auth_info_baileys/`.

## Shared settings

- Start command: `npm run start:optimized`
- Node.js: 20 or newer
- Wispbyte start command: `bash start.sh` (forces Node.js instead of Bun)
- Health endpoint: `/health`
- Required value: `OWNER_NUMBER`
- Pairing: enter the WhatsApp number in the server console, or set
  `PAIRING_PHONE` for a non-interactive host
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

## Console pairing

On first startup, the bot prints:

```text
WhatsApp number:
```

Enter the full number with country code and digits only, for example:

```text
256706106326
```

The pairing code is then printed in the same console. In WhatsApp, open
**Linked Devices → Link a device → Link with phone number instead** and enter
that code.

## Wispbyte runtime requirement

Wispbyte can start JavaScript projects with Bun by default. Do not use Bun for
this bot. Select Node.js 20 and start with:

```bash
bash start.sh
```

The bot exits with a clear error if it detects Bun. The `[Bun] Warning:
ws.WebSocket ... event is not implemented` message means the runtime is still
incorrect and pairing will not work reliably.

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