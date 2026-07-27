# tv-nextjs

Full-screen synchronized video display for the experience. The TV connects to
the Socket.IO server with role `display`, dual-buffers videos, and crossfades
at the server-provided `execute_at_ms`.

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

Open [http://localhost:3001](http://localhost:3001). Set
`NEXT_PUBLIC_SOCKET_URL` when the server is not on the browser host at port
`4000`.

Video files live under `public/` and must match the `video_url` values in
`socket-server/data/zones.ts`.

## Scripts

```bash
npm run lint
npm run build
```

See the root `Readme.md` and `docs/RASPBERRY_PI_INTEGRATION.md` for the full
system contract.
