# Docker deploy (single image)

This repo ships as **one Docker image** for the site PC. Operators do not need
source code, Bun, or Node — only Docker Desktop and the export package.

## Services inside the image

| Process | Port | Notes |
|---|---|---|
| `socket-server` (Bun) | 4000 | Socket.IO + `/health` |
| `tablet-nextjs` (Next standalone) | 3000 | Operator UI |
| `tv-nextjs` (Next standalone) | 3001 | Full-screen video |
| mock hardware (optional) | — | `ENABLE_MOCK_HARDWARE=1` |

## Build (dev machine)

Socket URLs are **not** the same for tablet and TV. They are taken from
[`ENVs/ENVs`](../ENVs/ENVs) at **image build** time (Next inlines `NEXT_PUBLIC_*`):

| App | File | Default (site) |
|---|---|---|
| Tablet | `ENVs/ENVs/tablet-nextjs/.env` | `https://192.168.0.111:5001` (Caddy, LAN tablet) |
| TV | `ENVs/ENVs/tv-nextjs/.env` | `http://localhost:4000` (same PC as kiosk/server) |
| Server | `ENVs/ENVs/socket-server/.env` | `HOST=0.0.0.0` `PORT=4000` (Caddy proxies `:5001` → this) |

Edit those files if the site IP or Caddy port changes, then rebuild.

```powershell
.\scripts\docker-build.bat
```

Or:

```powershell
docker build -t nagpur-marina:latest .
```

Do **not** give tablet and TV the same socket URL: TV stays on loopback;
tablet must use the Caddy HTTPS endpoint.

## Export site package

```powershell
.\scripts\docker-export.bat
```

Produces `dist/`:

- `nagpur-marina.tar` — single image
- `run.bat` / `stop.bat` — site launcher
- `README-SITE.txt` — operator notes

Copy the whole `dist/` folder to USB for the venue (no `socket-server` /
`tablet-nextjs` / `tv-nextjs` source tree).

## Site run

```bat
docker load -i nagpur-marina.tar   :: automatic via run.bat if image missing
run.bat
```

`run.bat` will:

1. Start host Caddy if present at the configured path
2. `docker load` when needed
3. `docker run -d --name nagpur-marina -p 3000:3000 -p 3001:3001 -p 4000:4000 ...`
4. Wait for `http://localhost:4000/health`
5. Open Chrome kiosk on `http://localhost:3001`

### Common env flags

```bat
docker run -d --name nagpur-marina --restart unless-stopped ^
  -p 3000:3000 -p 3001:3001 -p 4000:4000 ^
  -e ENABLE_MOCK_HARDWARE=1 ^
  nagpur-marina:latest
```

| Variable | Default | Purpose |
|---|---|---|
| `ENABLE_MOCK_HARDWARE` | `0` | Simulate both Pis inside the container |
| `PORT` / `HOST` | `4000` / `0.0.0.0` | Socket server bind |
| `CORS_ORIGIN` | `*` | Socket.IO CORS |
| `SOCKET_SERVER_URL` | `http://127.0.0.1:4000` | Mock hardware target |

## Network

- **Tablet** on LAN: `http://<host-lan-ip>:3000`
- **Socket URL** in the browser defaults to `hostname:4000` (not baked at build)
- **Pis**: `SOCKET_SERVER_URL=http://<host-lan-ip>:4000`
- **Firewall**: allow inbound TCP 3000, 3001, 4000 if other devices connect
- **Caddy**: reverse_proxy to `127.0.0.1:3000|3001|4000`; keep WebSocket support for 4000

## Remote enable (tablet lock)

The socket server calls the remote config URL at boot and every hour
(`socket-server/lib/consts.ts`). The host needs **outbound HTTPS**. If the
gist returns `enabled: false` or is unreachable, **tablets are locked** (contact
support UI) and the server logs a warning. TV and hardware keep running.

## Dev without Docker

Local development is unchanged:

```powershell
bun run install:all
bun run dev
# or
bun run dev:with-mock
```

## Smoke test after build

```powershell
docker run --rm -d --name nagpur-marina-test `
  -p 3000:3000 -p 3001:3001 -p 4000:4000 `
  -e ENABLE_MOCK_HARDWARE=1 `
  nagpur-marina:latest

curl http://localhost:4000/health
# Open http://localhost:3000 and http://localhost:3001

docker logs nagpur-marina-test
docker rm -f nagpur-marina-test
```

## Troubleshooting

| Symptom | Check |
|---|---|
| `docker run` fails — port in use | Stop old bun/Next or `docker rm -f nagpur-marina` |
| Server exits immediately | `docker logs nagpur-marina` — port/env issues; remote lock no longer stops the server |
| `hardware_offline` | Real Pis offline, or turn on mock, not both |
| Image missing on site | Place `nagpur-marina.tar` next to `run.bat` |
| Caddy no traffic | Confirm upstreams are still localhost:3000/3001/4000 |
