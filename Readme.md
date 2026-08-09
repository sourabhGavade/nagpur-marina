# Raspberry Pi Experience Controller

This repository contains the four parts of the synchronized lighting and video
experience:

- `socket-server` — central Socket.IO coordinator and sequence runtime
- `tablet-nextjs` — tablet controls for Areas, Zones, and Lighting
- `tv-nextjs` — synchronized full-screen video display
- Raspberry Pi hardware agents — implemented separately against
  `docs/RASPBERRY_PI_INTEGRATION.md`

The server starts video and hardware transitions at the same future timestamp.
Area sequences preload the next video, crossfade between videos, and continue
until paused, stopped, overridden, or interrupted by a fail-safe.

Exactly **two** hardware clients are required: `raspberry-pi-1` (Main Model)
and `raspberry-pi-2` (Clubhouse). Combined hardware status is online only when
both are connected and ready.

## Requirements

- [Bun](https://bun.sh/) for the Socket.IO server
- Node.js 20+ and npm for the Next.js applications
- A modern browser with WebSocket and autoplay support
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for site packaging and venue install

## Site install (single Docker image)

Venues run **one** image with no source tree. Full details:
[docs/DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md) and
[docs/README-SITE.txt](docs/README-SITE.txt).

**Build and export (dev machine):**

```powershell
.\scripts\docker-build.bat
.\scripts\docker-export.bat
```

Copy everything under `dist/` (especially `nagpur-marina.tar`, `run.bat`,
`stop.bat`) to the site PC.

**On site:** install Docker Desktop once, then double-click `run.bat`. That
loads the image if needed, starts the container (`3000` / `3001` / `4000`),
optionally starts host Caddy, and opens the TV kiosk. Use `stop.bat` to stop.

Host Caddy can keep reverse-proxying to `localhost:3000`, `:3001`, and `:4000`
as before. Set `ENABLE_MOCK_HARDWARE=1` in `run.bat` only when running without
real Raspberry Pis.

## Install

From the repo root, install root tooling and all apps once:

```powershell
bun install
bun run install:all
```

## Test locally without a Raspberry Pi

From the repo root, start the server, mock hardware (both Pis), TV, and tablet
together:

```powershell
bun run dev:with-mock
```

Or start only the three apps (use real Pis, or start mock hardware separately):

```powershell
bun run dev
```

Open:

- Tablet: `http://localhost:3000`
- TV: `http://localhost:3001`
- Server health: `http://localhost:4000/health`

Click **Begin journey** on the tablet. The status pills must show the Tablet,
Hardware, and Display online before playback commands can succeed.

Do not run `mock:hardware` (or `dev:with-mock`) at the same time as the real Pi
agents. The server expects exactly two hardware clients with distinct IDs.

To run services in separate terminals instead:

```powershell
# Terminal 1: central server (port 4000)
cd socket-server
bun run dev
```

```powershell
# Terminal 2: simulated Pi hardware (both raspberry-pi-1 and raspberry-pi-2)
cd socket-server
bun run mock:hardware
```

```powershell
# Terminal 3: TV display (port 3001)
cd tv-nextjs
bun run dev
```

```powershell
# Terminal 4: tablet controls (port 3000)
cd tablet-nextjs
bun run dev
```

## Run on the installation network

The server listens on all interfaces by default. Determine the central
computer's LAN address, for example `192.168.1.15`, and configure both Next.js
apps before building or starting them:

```powershell
$env:NEXT_PUBLIC_SOCKET_URL="http://192.168.1.15:4000"
```

Each Pi agent uses:

```powershell
$env:SOCKET_SERVER_URL="http://192.168.1.15:4000"
```

Supported server environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | Socket.IO and health-check port |
| `HOST` | `0.0.0.0` | Server bind address |
| `CORS_ORIGIN` | `*` | Allowed browser origin |
| `NEXT_PUBLIC_SOCKET_URL` | Current browser host on port `4000` | Tablet/TV server URL |
| `SOCKET_SERVER_URL` | `http://127.0.0.1:4000` | Mock hardware server URL |

## Controls

- **Area Play** starts the selected Area and continues through ordered Areas.
- The current Area and Zone are highlighted on the tablet.
- **Zone Play** overrides the Area sequence and loops that Zone video.
- **Lighting** toggles Main Model or Clubhouse lighting groups
  (`lighting-control`). Main Model commands go only to `raspberry-pi-1`;
  Clubhouse commands go only to `raspberry-pi-2`. Lighting does not drive the
  TV.
- **Pause** freezes the video at its current position while lights retain their
  current state.
- **Resume** continues video and Area timing from the paused position.
- **Stop** stops video, cancels the sequence, and switches all outputs off on
  both Pis.
- A disconnect, heartbeat timeout, or device error triggers safe idle.

Area and Zone activations still broadcast the same `hardware-apply-state`
payload to both Pis. Dedicated Lighting controls are model-routed to one Pi.

The TV uses two video elements. It preloads the next video in the hidden
element, waits until it can play, and crossfades at the server-provided time.

## Content configuration

Edit:

- `socket-server/data/areas.ts`
- `socket-server/data/zones.ts`
- `socket-server/data/sub-zones.ts`
- `socket-server/data/lighting.ts`

Lighting groups reference Sub-zones and a `model` of `main-model` or
`clubhouse`. Zone tablet images live under `tablet-nextjs/public/images/zones`.
TV videos live under `tv-nextjs/public`. Their configured URLs must match these
public paths. Restart the Socket.IO server after changing configuration data.

## Validation

```powershell
cd socket-server
bun test
bun run typecheck

cd ..\tablet-nextjs
npm run lint
npm run build

cd ..\tv-nextjs
npm run lint
npm run build
```

## Troubleshooting

- **`hardware_offline`** — start both Pi agents or `bun run mock:hardware`.
- **`display_offline`** — open the TV application and wait for Display online.
- **Duplicate client error** — close the previous Pi or TV connection; each
  hardware `client_id` may connect only once.
- **Image/video 404** — verify the configured URL matches a file in `public`.
- **Control page returns to start after refresh** — reconnect using
  **Begin journey**; runtime data is held in React Context for the session.

See `docs/EDGE_CASES.md` for implemented failure handling, known limits, and
test coverage.

See `docs/RASPBERRY_PI_INTEGRATION.md` for the complete hardware contract.
