/**
 * EXPRESS SERVER
 * - Status page; pairing is handled in the hosting console
 * - Keep-alive ping endpoint
 * - Status endpoint
 */

const express = require('express');
const config  = require('./config');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let botSock         = null;
let isConnected      = false;

function setBotSocket(sock) { botSock = sock; }
function setConnected(val)    { isConnected = val; }

/* ── HTML shell ─────────────────────────────────────────────────────────── */
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
    label{display:block;font-size:.8rem;font-weight:600;color:#94a3b8;
          text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
    input[type=tel]{
      width:100%;padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);
      background:rgba(255,255,255,0.06);color:#f1f5f9;font-size:1rem;outline:none;
      transition:border-color .2s;
    }
    input[type=tel]:focus{border-color:#25d366}
    .hint{font-size:.75rem;color:#64748b;margin-top:8px;margin-bottom:22px}
    button{
      width:100%;padding:15px;border-radius:12px;border:none;cursor:pointer;
      background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;
      font-size:1rem;font-weight:700;letter-spacing:.02em;
      transition:opacity .2s,transform .1s;
    }
    button:hover{opacity:.9}
    button:active{transform:scale(.98)}
    button:disabled{opacity:.5;cursor:not-allowed}

    /* code box */
    .code-wrap{text-align:center;margin-top:10px}
    .code-label{font-size:.8rem;color:#94a3b8;margin-bottom:14px;text-transform:uppercase;letter-spacing:.05em}
    .code{
      display:inline-block;font-size:2.4rem;font-weight:800;letter-spacing:.3em;
      color:#25d366;background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.2);
      border-radius:14px;padding:16px 28px;font-variant-numeric:tabular-nums;
      font-family:'Courier New',monospace;
    }
    .steps{
      margin-top:22px;background:rgba(255,255,255,0.04);border-radius:12px;
      padding:18px 20px;font-size:.82rem;color:#94a3b8;line-height:1.9;
    }
    .steps span{color:#f1f5f9;font-weight:600}
    .badge{
      display:inline-block;padding:3px 10px;border-radius:20px;font-size:.72rem;
      font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-left:8px;
    }
    .online {background:rgba(37,211,102,.15);color:#25d366;border:1px solid rgba(37,211,102,.25)}
    .offline{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}
    .status-row{display:flex;align-items:center;justify-content:center;margin-bottom:24px;font-size:.83rem;color:#64748b}
    .err{color:#f87171;font-size:.85rem;text-align:center;margin-top:14px}
    .spinner{
      display:inline-block;width:18px;height:18px;border:2px solid rgba(255,255,255,0.2);
      border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;
      vertical-align:middle;margin-right:8px;
    }
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="card">${body}</div>
  <script>
    // Auto-copy code on click
    document.addEventListener('click', e => {
      if (e.target.classList.contains('code')) {
        navigator.clipboard?.writeText(e.target.innerText.replace(/-/g,''));
        e.target.title = 'Copied!';
        setTimeout(() => e.target.title = '', 1500);
      }
    });
  </script>
</body>
</html>`;

/* ── Root — status only; console handles pairing ────────────────────────── */
app.get('/', (req, res) => {
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
    <div class="status-row">Status <span class="badge offline">● Waiting for console pairing</span></div>
    <div class="steps">
      Pairing is handled in the server console.<br><br>
      Enter your WhatsApp number in the hosting console. The pairing code will be printed there.
    </div>
  `));
});

/* ── Pairing routes intentionally disabled ──────────────────────────────── */
app.post('/pair', async (req, res) => {
  res.status(410).send('Pairing is console-only. Enter your number in the server console.');
});

app.get('/pair', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Pairing is console-only. Enter your number in the server console.',
  });
});

/* ── Health / keep-alive ─────────────────────────────────────────────────── */
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/ping',   (_req, res) => res.json({ pong: true, ts: Date.now() }));

/* ── Status ──────────────────────────────────────────────────────────────── */
app.get('/status', (req, res) => {
  const { getAIStatus } = require('./plugins/ai');
  res.json({
    bot: config.BOT_NAME,
    owner: config.OWNER_NUMBER,
    connected: isConnected,
    user: botSock?.user || null,
    config: {
      prefix: config.PREFIX,
      antiDelete: config.ANTI_DELETE,
      antiEdit: config.ANTI_EDIT,
      autoStatusView: config.AUTO_STATUS_VIEW,
      autoBio: config.AUTO_BIO,
    },
    ai: getAIStatus(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

function startServer() {
  const port = config.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Running → http://localhost:${port}`);
    console.log('[Server] Pairing is handled in this console; the URL is for health/status only.');
  });
  return app;
}

module.exports = { startServer, setBotSocket, setConnected, app };
