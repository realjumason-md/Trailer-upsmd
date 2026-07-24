/**
 * UPDATE — pull latest code from GitHub and restart
 * Based on MEGA-MD's update.js
 *
 * Key improvements:
 *  - exec() instead of execSync (non-blocking, timeout-safe)
 *  - Shows commit list and changed files before pulling
 *  - Smarter package manager detection (pnpm → yarn → npm)
 *  - git clean -fd after reset to remove stale generated files
 */

import { exec } from 'child_process';
import fs from 'fs';
import config from '../config.js';
import { isOwner, reply, reactTo } from '../lib/utils.js';

function run(cmd, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true, timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || stdout || err.message || '').toString().trim()));
      resolve((stdout || '').toString().trim());
    });
  });
}

async function detectPm() {
  try { await run('which pnpm'); return 'pnpm'; } catch {}
  try { await run('which yarn'); return 'yarn'; } catch {}
  return 'npm';
}

export async function handleUpdate(sock, msg, parsed) {
  if (parsed?.command !== 'update') return false;
  if (!isOwner(msg)) { await reply(sock, msg, '🔒 Owner only.'); return true; }

  try {
    await reactTo(sock, msg, '⏳');

    if (!fs.existsSync('.git')) {
      await reply(sock, msg, '❌ No .git directory found. The .update command requires a git repository.');
      return true;
    }
    try { await run('git --version'); } catch {
      await reply(sock, msg, '❌ git is not installed on this server.');
      return true;
    }

    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune', 30000);
    const newRev = (await run(`git rev-parse origin/${config.GITHUB_BRANCH}`)).trim();

    if (oldRev === newRev) {
      await reactTo(sock, msg, '✅');
      await reply(sock, msg, '✅ *Already up to date* — no updates found.');
      return true;
    }

    // Show changelog
    const commits = await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files   = await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');

    let summary = `📦 *Updates found!*\n\n`;
    if (commits) {
      const lines = commits.split('\n').slice(0, 6);
      summary += `📝 *Commits:*\n${lines.map(c => `• ${c}`).join('\n')}\n`;
      if (commits.split('\n').length > 6) summary += `_...and more_\n`;
    }
    if (files) {
      const lines = files.split('\n').slice(0, 8);
      summary += `\n📁 *Files changed:*\n${lines.map(f => `• ${f}`).join('\n')}\n`;
      if (files.split('\n').length > 8) summary += `_...and more_\n`;
    }
    await reply(sock, msg, summary + '\n⬇️ Pulling...');

    await run(`git reset --hard ${newRev}`, 60000);
    await run('git clean -fd', 30000);

    await reply(sock, msg, '📦 Installing dependencies...');
    const pm = await detectPm();
    await run(`${pm} install`, 120000);

    await reactTo(sock, msg, '✅');
    await reply(sock, msg, `✅ *Update complete!*\n🔄 Restarting bot now...`);
    setTimeout(() => process.exit(0), 2000);

  } catch (err) {
    await reactTo(sock, msg, '❌');
    await reply(sock, msg, `❌ Update failed: ${err.message}`);
  }
  return true;
}
