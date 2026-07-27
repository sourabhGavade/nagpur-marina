# tablet-nextjs

Operator tablet UI for the synchronized lighting and video experience.

## Pages

| Route | Purpose |
|---|---|
| `/` | Connect and begin the journey |
| `/journey` | Choose Areas, Zones, or Lighting |
| `/areas` | Activate ordered Areas |
| `/zones` | Activate individual Zones |
| `/lighting` | Toggle Main Model and Clubhouse lighting groups |

The tablet connects to the Socket.IO server with role `tablet`, receives
`system-layout` (Areas, Zones, Sub-zones, and Lightings), and emits control
events with ACK callbacks.

## Getting started

From the repo root (recommended):

```powershell
bun run dev
```

Or from this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set
`NEXT_PUBLIC_SOCKET_URL` when the server is not on the browser host at port
`4000`.

## Scripts

```bash
npm run lint
npm run build
```

See the root `Readme.md` for full local testing with the socket server, mock
hardware, and TV display.
