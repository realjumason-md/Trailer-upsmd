#!/usr/bin/env bash
# ─── Trailer-UPS BOT — start script ───────────────────────────────────────────
set -e

echo "🤖 Trailer-UPS BOT starting..."

# Install / update deps if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

exec node --max-old-space-size=512 index.js "$@"
