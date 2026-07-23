/**
 * SESSION RESTORE
 * Decode a base64-encoded creds.json (SESSION_ID) and write it to the session folder.
 * This lets users paste a session string to skip interactive pairing.
 */

import fs from 'fs';
import path from 'path';

/**
 * @param {string} sessionDir  Absolute path to the session directory
 * @param {string} sessionId   Base64-encoded creds.json string
 * @returns {boolean} true if session was written and looks valid
 */
export async function loadSession(sessionDir, sessionId) {
  if (!sessionId) return false;

  try {
    // Strip any whitespace or prefix the user might have added
    const raw = Buffer.from(sessionId.trim(), 'base64').toString('utf8');
    const creds = JSON.parse(raw);

    // Quick sanity check before writing
    if (!creds.noiseKey || !creds.signedIdentityKey) {
      console.error('[Session] SESSION_ID decoded but is missing required fields. Ignoring.');
      return false;
    }

    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(creds, null, 2));
    return true;
  } catch (err) {
    console.error('[Session] Failed to decode SESSION_ID:', err.message);
    return false;
  }
}
