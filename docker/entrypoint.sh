#!/bin/bash
set -uo pipefail

ENABLE_MOCK_HARDWARE="${ENABLE_MOCK_HARDWARE:-0}"
declare -A PROC_NAME=()
pids=()

log() {
  # shellcheck disable=SC2145
  echo "[entrypoint] $*"
}

# Strip CR / trim so Windows-saved .env files cannot break HOST/PORT binds.
sanitize() {
  printf '%s' "$1" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

load_env_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return 0
  fi
  log "Loading env from ${file}"
  # Read KEY=VALUE lines only (ignore comments / blanks); always strip CR.
  while IFS= read -r line || [ -n "$line" ]; do
    line="$(sanitize "$line")"
    case "$line" in
      ""|\#*) continue ;;
    esac
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      # Drop surrounding quotes if present
      if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; fi
      if [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
      export "${key}=${val}"
      log "  ${key}=${val}"
    fi
  done < "$file"
}

# Kill process trees cleanly so listeners release ports before Docker restarts us.
shutdown() {
  log "Shutting down..."
  local pid
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping ${PROC_NAME[$pid]:-pid}:$pid"
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
  for pid in "${pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  # Best-effort free well-known ports inside this container
  fuser -k 4000/tcp 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  fuser -k 3001/tcp 2>/dev/null || true
  exit 0
}

trap shutdown SIGTERM SIGINT

start_bg() {
  local name="$1"
  shift
  log "Starting ${name}: $*"
  (
    exec "$@"
  ) &
  local pid=$!
  pids+=("$pid")
  PROC_NAME["$pid"]="$name"
  log "  ${name} pid=${pid}"
}

# Free port if a previous crash left a listener (common with Docker restarts on Windows)
ensure_port_free() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    if fuser "${port}/tcp" >/dev/null 2>&1; then
      log "Port ${port} still held; killing listener"
      fuser -k "${port}/tcp" 2>/dev/null || true
      sleep 1
    fi
  fi
}

export HOST="$(sanitize "${HOST:-0.0.0.0}")"
export PORT="$(sanitize "${PORT:-4000}")"
export CORS_ORIGIN="$(sanitize "${CORS_ORIGIN:-*}")"

load_env_file /app/server/.env

HOST="$(sanitize "${HOST:-0.0.0.0}")"
PORT="$(sanitize "${PORT:-4000}")"
CORS_ORIGIN="$(sanitize "${CORS_ORIGIN:-*}")"
export HOST PORT CORS_ORIGIN

if [ "$HOST" = "localhost" ] || [ "$HOST" = "127.0.0.1" ]; then
  log "HOST=${HOST} is loopback-only; overriding to 0.0.0.0 for Docker"
  export HOST=0.0.0.0
fi

# Validate PORT is a plain integer (rejects values still containing CR/junk)
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  log "ERROR: invalid PORT='${PORT}' — falling back to 4000"
  export PORT=4000
fi

log "Socket bind: HOST=${HOST} PORT=${PORT}"
ensure_port_free "$PORT"
ensure_port_free 3000
ensure_port_free 3001

# Run from server dir so any Bun-relative paths resolve predictably
start_bg "socket-server" \
  bash -c "cd /app/server && exec env PORT='${PORT}' HOST='${HOST}' CORS_ORIGIN='${CORS_ORIGIN}' bun index.ts"

# Wait until /health answers (or fail after timeout)
log "Waiting for socket-server on :${PORT}..."
ready=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  # Bail early if server process already dead
  if ! kill -0 "${pids[0]}" 2>/dev/null; then
    wait "${pids[0]}" 2>/dev/null || true
    log "ERROR: socket-server exited before becoming healthy (exit $?)"
    exit 1
  fi
  sleep 0.5
done
if [ "$ready" -ne 1 ]; then
  log "ERROR: socket-server did not become healthy in time"
  exit 1
fi
log "socket-server is healthy"

start_bg "tablet" \
  env PORT=3000 HOSTNAME=0.0.0.0 node /app/tablet/server.js

start_bg "tv" \
  env PORT=3001 HOSTNAME=0.0.0.0 node /app/tv/server.js

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
      wait "$pid"
      status=$?
      log "Process ${PROC_NAME[$pid]:-unknown} (pid ${pid}) exited with status ${status}"
      log "Shutting down remaining services"
      shutdown
    fi
  done
  sleep 1
done
