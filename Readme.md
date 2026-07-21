# Raspberry Pi Experience Controller

This repository contains the four parts of the synchronized lighting and video
experience:

- `socket-server` — central Socket.IO coordinator and sequence runtime
- `tablet-nextjs` — tablet controls for Areas, Zones, and Sub-zones
- `tv-nextjs` — synchronized full-screen video display
- Raspberry Pi hardware agent — implemented separately against
  `RASPBERRY_PI_INTEGRATION.md`

The server starts video and hardware transitions at the same future timestamp.
Area sequences preload the next video, crossfade between videos, and continue
until paused, stopped, overridden, or interrupted by a fail-safe.

## Requirements

- [Bun](https://bun.sh/) for the Socket.IO server
- Node.js 20+ and npm for the Next.js applications
- A modern browser with WebSocket and autoplay support

## Install

Run once in each project:

```powershell
cd socket-server
bun install

cd ..\tablet-nextjs
npm install

cd ..\tv-nextjs
npm install
```

## Test locally without a Raspberry Pi

Start these in separate terminals, in this order:

```powershell
# Terminal 1: central server (port 4000)
cd socket-server
bun run dev
```

```powershell
# Terminal 2: simulated Pi hardware
cd socket-server
bun run mock:hardware
```

```powershell
# Terminal 3: TV display (port 3001)
cd tv-nextjs
npm run dev -- -p 3001
```

```powershell
# Terminal 4: tablet controls (port 3000)
cd tablet-nextjs
npm run dev -- -p 3000
```

Open:

- Tablet: `http://localhost:3000`
- TV: `http://localhost:3001`
- Server health: `http://localhost:4000/health`

Click **Begin journey** on the tablet. The status pills must show the Tablet,
Hardware, and Display online before playback commands can succeed.

Do not run `mock:hardware` at the same time as the real Pi agent. The server
allows only one hardware client.

## Run on the installation network

The server listens on all interfaces by default. Determine the central
computer's LAN address, for example `192.168.1.15`, and configure both Next.js
apps before building or starting them:

```powershell
$env:NEXT_PUBLIC_SOCKET_URL="http://192.168.1.15:4000"
```

The Pi agent uses:

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
| `MOCK_HARDWARE_ID` | `mock-hardware-home` | Mock client identifier |

## Controls

- **Area Play** starts the selected Area and continues through ordered Areas.
- The current Area and Zone are highlighted on the tablet.
- **Zone Play** overrides the Area sequence and loops that Zone video.
- **Sub-zone Play** activates one lighting element and loops its parent video.
- **Pause** freezes the video at its current position while lights retain their
  current state.
- **Resume** continues video and Area timing from the paused position.
- **Stop** stops video, cancels the sequence, and switches all outputs off.
- A disconnect, heartbeat timeout, or device error triggers safe idle.

The TV uses two video elements. It preloads the next video in the hidden
element, waits until it can play, and crossfades at the server-provided time.

## Content configuration

Edit:

- `socket-server/data/areas.ts`
- `socket-server/data/zones.ts`
- `socket-server/data/sub-zones.ts`

Tablet images live under `tablet-nextjs/public/images`. TV videos live under
`tv-nextjs/public`. Their configured URLs must match these public paths.
Restart the Socket.IO server after changing configuration data.

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

- **`hardware_offline`** — start the Pi agent or `bun run mock:hardware`.
- **`display_offline`** — open the TV application and wait for Display online.
- **Duplicate client error** — close the previous Pi or TV connection.
- **Image/video 404** — verify the configured URL matches a file in `public`.
- **Control page returns to start after refresh** — reconnect using
  **Begin journey**; runtime data is held in React Context for the session.

See `EDGE_CASES.md` for implemented failure handling, known limits, and test
coverage.

See `RASPBERRY_PI_INTEGRATION.md` for the complete hardware contract.
