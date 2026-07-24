/**
 * EXPRESS STATUS SERVER
 * Serves a health/status page and keep-alive endpoints.
 * Pairing is done through the hosting console — the server never handles it.
 *
 * Keep-alive: set KEEP_ALIVE_URL in .env to the public URL of this server
 * (e.g. https://your-app.onrender.com) and the server will ping itself every
 * KEEP_ALIVE_INTERVAL ms to prevent free-tier hosts from sleeping.
 */

import express from 'express';
import axios   from 'axios';
import config  from './config.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let isConnected = false;
let _sock       = null; // set by setSocket() if ping command needs it

export function setConnected(val) { isConnected = val; }
export function setSocket(s)      { _sock = s; }

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
      border-radius:20px;padding:40px 36px;width:100%;max-width:440px;
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
    .grid{display:grid;gap:10px;margin-bottom:20px}
    .item{
      background:rgba(0,0,0,0.2);padding:11px 16px;border-radius:10px;
      display:flex;justify-content:space-between;align-items:center;
    }
    .label{color:#64748b;font-size:.73rem;text-transform:uppercase;font-weight:800}
    .val{font-weight:600;font-family:monospace;color:#f1f5f9;font-size:.85rem}
    .steps{
      background:rgba(255,255,255,0.04);border-radius:12px;
      padding:18px 20px;font-size:.82rem;color:#94a3b8;line-height:1.9;
    }
    .steps span{color:#f1f5f9;font-weight:600}
  </style>
</head>
<body><div class="card">${body}</div></body>
</html>`;

// ── Uptime formatter ─────────────────────────────────────────────────────────
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ── Status page ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  const uptimeSec  = Math.floor(process.uptime());
  const ramMb      = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const upStr      = formatUptime(uptimeSec);

  const statsGrid = `
    <div class="grid">
      <div class="item"><span class="label">Uptime</span><span class="val">${upStr}</span></div>
      <div class="item"><span class="label">RAM</span><span class="val">${ramMb} MB</span></div>
      <div class="item"><span class="label">Node.js</span><span class="val">${process.version}</span></div>
    </div>`;

  if (isConnected) {
    return res.send(html(`
      <div class="logo">🤖</div>
      <h1>${config.BOT_NAME}</h1>
      <div class="sub">WhatsApp Bot</div>
      <div class="status-row">Status <span class="badge online">● Connected</span></div>
      ${statsGrid}
      <div class="steps">Your bot is <span>online and running</span>. No pairing needed.</div>
    `));
  }
  res.send(html(`
    <div class="logo">🤖</div>
    <h1>${config.BOT_NAME}</h1>
    <div class="sub">WhatsApp Bot</div>
    <div class="status-row">Status <span class="badge offline">● Waiting to connect</span></div>
    ${statsGrid}
    <div class="steps">
      Pairing is done in the <span>server console</span>.<br><br>
      Check your hosting console — the pairing code will appear there.
    </div>
  `));
});

// ── Health / keep-alive endpoints ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok:        true,
    connected: isConnected,
    uptime:    Math.floor(process.uptime()),
    memory: {
      rss:       `${(mem.rss       / 1024 / 1024).toFixed(1)} MB`,
      heapUsed:  `${(mem.heapUsed  / 1024 / 1024).toFixed(1)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
    },
    node: process.version,
  });
});

app.get('/ping', (_req, res) => res.json({ pong: true, ts: Date.now() }));

app.get('/status', (_req, res) => {
  res.json({
    bot:       config.BOT_NAME,
    owner:     config.OWNER_NUMBER,
    connected: isConnected,
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── Self-ping keep-alive ──────────────────────────────────────────────────────
// For free-tier hosts (Render, Railway, Koyeb, etc.) that spin down after
// inactivity. Set KEEP_ALIVE_URL to the public URL of this service to enable.
// Example: KEEP_ALIVE_URL=https://your-app.onrender.com
function startKeepAlive(url, intervalMs) {
  const pingUrl = url.replace(/\/$/, '') + '/ping';
  console.log(`[Keep-alive] Pinging ${pingUrl} every ${intervalMs / 60000} min`);

  setInterval(async () => {
    try {
      const { data } = await axios.get(pingUrl, { timeout: 10000 });
      if (data?.pong) {
        console.log(`[Keep-alive] ✅ pong at ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error(`[Keep-alive] ❌ ping failed: ${err.message}`);
    }
  }, intervalMs);
}

// ── Start ─────────────────────────────────────────────────────────────────────
export function startServer() {
  const port = config.PORT;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] http://localhost:${port} — pairing is handled in the console`);
  });

  // Start keep-alive pinger if a public URL is configured
  if (config.KEEP_ALIVE_URL) {
    // Delay first ping by 30 s so the server is fully up
    setTimeout(() => startKeepAlive(config.KEEP_ALIVE_URL, config.KEEP_ALIVE_INTERVAL), 30_000);
  }

  return app;
}
