#!/bin/bash
set -euo pipefail

ENABLE_MOCK_HARDWARE="${ENABLE_MOCK_HARDWARE:-0}"
pids=()

log() {
  echo "[entrypoint] $*"
}

# Load KEY=VALUE pairs from a .env file into the environment (export).
load_env_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return 0
  fi
  log "Loading env from ${file}"
  set -a
  # shellcheck disable=SC1090
  . "$file"
  set +a
}

shutdown() {
  log "Shutting down..."
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait || true
  exit 0
}

trap shutdown SIGTERM SIGINT

start_bg() {
  local name="$1"
  shift
  log "Starting ${name}: $*"
  "$@" &
  pids+=($!)
}

# Defaults if .env missing (Docker host publish + Caddy need 0.0.0.0, not localhost)
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-4000}"
export CORS_ORIGIN="${CORS_ORIGIN:-*}"
load_env_file /app/server/.env
# Force usable bind for container networking even if a bad HOST slipped into .env
if [ "${HOST}" = "localhost" ] || [ "${HOST}" = "127.0.0.1" ]; then
  log "HOST=${HOST} is loopback-only; overriding to 0.0.0.0 for Docker"
  export HOST=0.0.0.0
fi

# Socket.IO coordinator (Caddy :5001 → host :4000 → this process)
start_bg "socket-server" \
  env PORT="${PORT}" HOST="${HOST}" CORS_ORIGIN="${CORS_ORIGIN}" \
  bun /app/server/index.ts

sleep 1

# Tablet UI (proxied by Caddy as https://192.168.0.111); socket URL baked at build
start_bg "tablet" \
  env PORT=3000 HOSTNAME=0.0.0.0 \
  node /app/tablet/server.js

# TV kiosk on same machine (http://localhost:3001 → socket http://localhost:4000 baked)
start_bg "tv" \
  env PORT=3001 HOSTNAME=0.0.0.0 \
  node /app/tv/server.js

if [ "$ENABLE_MOCK_HARDWARE" = "1" ] || [ "$ENABLE_MOCK_HARDWARE" = "true" ]; then
  start_bg "mock-hardware" \
    env SOCKET_SERVER_URL="${SOCKET_SERVER_URL:-http://127.0.0.1:4000}" \
    bun /app/server/scripts/mock-hardware.ts
  log "Mock hardware enabled"
else
  log "Mock hardware disabled (set ENABLE_MOCK_HARDWARE=1 to enable)"
fi

log "All services started (pids: ${pids[*]})"
log "  tablet  (container) :3000  — socket URL baked: Caddy/LAN (see tablet .env)"
log "  tv      (container) :3001  — socket URL baked: localhost:4000 (see tv .env)"
log "  server  (container) ${HOST}:${PORT}  — also via Caddy https://host:5001"

while true; do
  for pid in "${pids[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid" || true
      log "Process ${pid} exited; shutting down remaining services"
      shutdown
    fi
  done
  sleep 1
done
