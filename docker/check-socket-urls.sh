#!/bin/sh
# Find socket URL patterns in tablet/tv static bundles
for app in tablet tv; do
  echo "=== $app ==="
  grep -rhoE 'https?://[^"'\'' ]{0,60}|wss?://[^"'\'' ]{0,60}|192\.168\.[0-9.]+:[0-9]+|localhost:[0-9]+' \
    "/app/$app/.next/static" 2>/dev/null | sort | uniq -c | sort -rn | head -30
done
