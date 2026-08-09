#!/bin/bash
set -euo pipefail

ENABLE_MOCK_HARDWARE="${ENABLE_MOCK_HARDWARE:-0}"
pids=()

log() {
  echo "[entrypoint] $*"
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

# Socket.IO coordinator
start_bg "socket-server" \
  env PORT="${PORT:-4000}" HOST="${HOST:-0.0.0.0}" CORS_ORIGIN="${CORS_ORIGIN:-*}" \
  bun /app/server/index.ts

# Wait briefly for the socket server so mock hardware can connect
sleep 1

# Next.js tablet (port 3000)
start_bg "tablet" \
  env PORT=3000 HOSTNAME=0.0.0.0 \
  node /app/tablet/server.js

# Next.js TV (port 3001)
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
log " tablet  http://0.0.0.0:3000"
log " tv      http://0.0.0.0:3001"
log " server  http://0.0.0.0:${PORT:-4000}"

# Exit if any child exits
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
