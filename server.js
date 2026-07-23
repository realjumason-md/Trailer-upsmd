/**
 * EXPRESS STATUS SERVER
 * Serves a health/status page and keep-alive endpoints.
 * Pairing is done through the hosting console — the server never handles it.
 */

import express from 'express';
import config  from './config.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let isConnected = false;

export function setConnected(val) { isConnected = val; }

// ── HTML shell ───────────────────────────────────────────────────────────────
const html = (body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${config.BOT_NAME} — Status</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#0a0a0a 0%,#111827 50%,#0a0a0a 100%);
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
      color:#f1f5f9;padding:20px;
    }
    .card{
      background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
      border-radius:20px;padding:40px 36px;width:100%;max-width:420px;
      backdrop-filter:blur(12px);box-shadow:0 25px 60px rgba(0,0,0,0.5);
    }
    .logo{
      width:64px;height:64px;background:linear-gradient(135deg,#25d366,#128c7e);
      border-radius:18px;display:flex;align-items:center;justify-content:center;
      font-size:30px;margin:0 auto 20px;box-shadow:0 8px 24px rgba(37,211,102,0.3);
    }
    h1{text-align:center;font-size:1.35rem;font-weight:700;margin-bottom:4px}
    .sub{text-align:center;font-size:.85rem;color:#94a3b8;margin-bottom:28px}
    .badge{
      display:inline-block;padding:3px 10px;border-radius:20px;font-size:.72rem;
      font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-left:8px;
    }
    .online {background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.25)}
    .offline{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}
    .status-row{display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:.83rem;color:#64748b}
    .steps{
      background:rgba(255,255,255,0.04);border-radius:12px;
      padding:18px 20px;font-size:.82rem;color:#94a3b8;line-height:1.9;
    }
    .steps span{color:#f1f5f9;font-weight:600}
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`;

// ── Status page ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  if (isConnected) {
    return res.send(html(`
      <div class="logo">🤖</div>
      <h1>${config.BOT_NAME}</h1>
      <div class="sub">WhatsApp Bot</div>
      <div class="status-row">Status <span class="badge online">● Connected</span></div>
      <div class="steps">
        Your bot is <span>online and running</span>.<br>
        No pairing needed — session is active.
      </div>
    `));
  }
  res.send(html(`
    <div class="logo">🤖</div>
    <h1>${config.BOT_NAME}</h1>
    <div class="sub">WhatsApp Bot</div>
    <div class="status-row">Status <span class="badge offline">● Waiting to connect</span></div>
    <div class="steps">
      Pairing is done in the <span>server console</span>.<br><br>
      Check your hosting console — the pairing code will appear there.
    </div>
  `));
});

// ── Health / keep-alive ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get('/ping',   (_req, res) => res.json({ pong: true, ts: Date.now() }));

app.get('/status', (_req, res) => {
  res.json({
    bot:       config.BOT_NAME,
    owner:     config.OWNER_NUMBER,
    connected: isConnected,
    uptime:    process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
export function startServer() {
  const port = config.PORT;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] http://localhost:${port} — pairing is handled in the console`);
  });
  return app;
}
