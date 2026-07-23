/**
 * UPDATE / REDEPLOY PLUGIN
 * .update — pulls latest code from GitHub and restarts the bot (no re-pairing needed)
 * Session is preserved in auth_info_baileys folder
 */

const { execSync, spawn } = require('child_process');
const config = require('../config');
const { isOwner, reply, reactTo } = require('../lib/utils');

function runCmd(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', ...opts }).trim();
}

async function handleUpdate(sock, msg, { command }) {
  if (!['update', 'redeploy', 'restart'].includes(command)) return;
  if (!isOwner(msg)) return reply(sock, msg, '❌ Only the bot owner can use this command.');

  await reactTo(sock, msg, '⏳');

  if (command === 'restart') {
    await reply(sock, msg, '🔄 Restarting bot... Session is preserved, no re-pairing needed.');
    setTimeout(() => {
      process.exit(0); // Process manager (PM2/Heroku/Wispbyte) will auto-restart
    }, 2000);
    return;
  }

  if (command === 'update' || command === 'redeploy') {
    await reply(sock, msg, '📥 Checking for updates from GitHub...');

    try {
      // Fetch remote info
      let gitOutput = '';
      try {
        gitOutput = runCmd('git fetch origin && git log HEAD..origin/main --oneline', { timeout: 30000 });
      } catch {
        gitOutput = '';
      }

      if (!gitOutput && command === 'update') {
        return reply(sock, msg, '✅ Already up to date! No updates available.');
      }

      await reply(sock, msg,
        `📦 *Updates found:*\n\`\`\`\n${gitOutput || 'Applying updates...'}\n\`\`\`\n\n⬇️ Pulling updates...`
      );

      // Pull latest code
      try {
        runCmd('git pull origin main', { timeout: 60000 });
      } catch (e) {
        return reply(sock, msg, `❌ Git pull failed:\n${e.message}`);
      }

      await reply(sock, msg, '📦 Installing dependencies...');

      // Install dependencies
      try {
        const pm = (() => {
          try { runCmd('which pnpm'); return 'pnpm'; } catch {}
          try { runCmd('which yarn'); return 'yarn'; } catch {}
          return 'npm';
        })();
        runCmd(`${pm} install --frozen-lockfile 2>/dev/null || ${pm} install`, { timeout: 120000 });
      } catch (e) {
        // Non-fatal
      }

      await reply(sock, msg,
        `✅ *Update complete!*\n\n🔄 Restarting bot now...\n_Session preserved — no re-pairing needed!_`
      );

      setTimeout(() => {
        process.exit(0);
      }, 3000);
    } catch (err) {
      await reactTo(sock, msg, '❌');
      return reply(sock, msg, `❌ Update failed: ${err.message}`);
    }
  }
}

module.exports = { handleUpdate };
