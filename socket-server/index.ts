import {
  assertRemoteEnabledOrThrow,
  startRemoteEnableWatcher,
} from "./lib/remote-enable.ts";
import { createSocketServer } from "./lib/server.ts";

const port = Number(Bun.env.PORT ?? 4000);
const hostname = Bun.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer from 1 through 65535");
}

await assertRemoteEnabledOrThrow();

const server = createSocketServer({
  corsOrigin: Bun.env.CORS_ORIGIN ?? "*",
});

await server.listen(port, hostname);
console.info(`Socket.IO server listening on http://${hostname}:${port}`);

let shuttingDown = false;
let stopRemoteEnableWatcher = () => {};

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  stopRemoteEnableWatcher();

  console.info(`Received ${signal}; shutting down`);
  await server.close();
  process.exit(0);
}

stopRemoteEnableWatcher = startRemoteEnableWatcher(() =>
  shutdown("remote-enable-lock"),
);

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
