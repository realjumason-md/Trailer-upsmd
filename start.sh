#!/usr/bin/env bash
# Force Node.js — prevents Bun or Deno from picking this up on Wispbyte
exec node --max-old-space-size=512 index.js
