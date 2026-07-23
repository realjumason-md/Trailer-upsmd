/**
 * UPDATE — pull latest code from GitHub and restart
 */

import { execSync } from 'child_process';
import config from '../config.js';
import { isOwner, reply, reactTo } from '../lib/utils.js';

function runCmd(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', timeout: opts.timeout || 60000 }).trim();
}

export async function handleUpdate(sock, msg, parsed) {
  const { command } = parsed;
  if (!['update', 'restart'].includes(command)) return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  // update (restart is handled earlier in index.js — this branch only runs for 'update')
  try {
    await reactTo(sock, msg, '⏳');

    let gitOutput = '';
    try {
      gitOutput = runCmd(`git fetch origin && git log HEAD..origin/${config.GITHUB_BRANCH} --oneline`, { timeout: 30000 });
    } catch {
      gitOutput = '';
    }

    if (!gitOutput) {
      return reply(sock, msg, '✅ Already up to date — no updates found.');
    }

    await reply(sock, msg,
      `📦 *Updates found:*\n\`\`\`\n${gitOutput}\n\`\`\`\n\n⬇️ Pulling updates...`
    );

    runCmd(`git pull origin ${config.GITHUB_BRANCH}`, { timeout: 60000 });
    await reply(sock, msg, '📦 Installing dependencies...');

    try {
      const pm = (() => {
        try { runCmd('which pnpm'); return 'pnpm'; } catch {}
        try { runCmd('which yarn'); return 'yarn'; } catch {}
        return 'npm';
      })();
      runCmd(`${pm} install`, { timeout: 120000 });
    } catch {}

    await reply(sock, msg, '✅ *Update complete!*\n🔄 Restarting bot now...');
    setTimeout(() => process.exit(0), 3000);

  } catch (err) {
    await reactTo(sock, msg, '❌');
    await reply(sock, msg, `❌ Update failed: ${err.message}`);
  }
  return true;
}
