# socket-server

Install dependencies:

```bash
bun install
```

Run the development server with automatic restart:

```bash
bun run dev
```

The server listens on port `4000` by default. Use `PORT`, `HOST`, and
`CORS_ORIGIN` environment variables to override its network settings.

Every Socket.IO client must identify itself through handshake authentication:

```ts
io("http://localhost:4000", {
  transports: ["websocket"],
  auth: {
    role: "tablet", // "tablet", "hardware", or "display"
    client_id: "tablet-1",
  },
});
```

Other commands:

```bash
bun run start
bun run test
bun run typecheck
bun run mock:hardware
```

`bun run mock:hardware` connects both `raspberry-pi-1` and `raspberry-pi-2`
and prints the full JSON payload for every inbound server event. Pass one or
more IDs to connect a subset:

```bash
bun run mock:hardware:1
bun run mock:hardware:2
bun scripts/mock-hardware.ts raspberry-pi-1 raspberry-pi-2
```

The HTTP health endpoint is available at `GET /health`.

Hardware and display clients must acknowledge their readiness check before the
server reports them online. Exactly two hardware clients with distinct
`client_id` values are required; hardware status is online only when both are
ready. Lighting commands are broadcast to both Pis. The server sends
`server-heartbeat` every five seconds and marks a client offline after 30
seconds without its corresponding heartbeat. A failed readiness check,
heartbeat timeout, or disconnect invalidates active runtime work and triggers
the available safe-off and display-stop commands.

Implemented Tablet controls:

- `area-activation`
- `zone-activation`
- `subzone-control`
- `sequence-stop`
- `global-emergency-stop`

Area activation starts from the selected Area, follows ordered Zones through
subsequent Areas, wraps to the first Area, and continues until another control,
Stop, fail-safe, or emergency invalidates its runtime generation.
