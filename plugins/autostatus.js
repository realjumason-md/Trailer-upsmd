/**
 * AUTO STATUS VIEW — automatically views WhatsApp status updates
 */

export async function handle(sock, msg) {
  try {
    if (msg.key?.remoteJid !== 'status@broadcast') return;
    await sock.readMessages([msg.key]);
  } catch (err) {
    console.error('[autostatus]', err.message);
  }
}

export default { handle };
