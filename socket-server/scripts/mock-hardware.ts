import { io, type Socket } from "socket.io-client";
import type {
  HardwareApplyStatePayload,
  HardwareToServerEvents,
  ServerToHardwareEvents,
} from "../utils/types.ts";

const serverUrl = Bun.env.SOCKET_SERVER_URL ?? "http://127.0.0.1:4000";
const DEFAULT_PI_IDS = ["raspberry-pi-1", "raspberry-pi-2"] as const;

/**
 * Resolve which mock Pis to connect.
 *
 * Examples:
 *   bun scripts/mock-hardware.ts
 *   bun scripts/mock-hardware.ts raspberry-pi-1
 *   MOCK_HARDWARE_ID=raspberry-pi-2 bun scripts/mock-hardware.ts
 *   MOCK_HARDWARE_IDS=raspberry-pi-1,raspberry-pi-2 bun scripts/mock-hardware.ts
 */
function resolveHardwareIds(): string[] {
  const fromArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  if (fromArgs.length > 0) return fromArgs;

  const fromList = Bun.env.MOCK_HARDWARE_IDS?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (fromList && fromList.length > 0) return fromList;

  const single = Bun.env.MOCK_HARDWARE_ID?.trim();
  if (single) return [single];

  return [...DEFAULT_PI_IDS];
}

function logPayload(piId: string, event: string, payload: unknown): void {
  console.info(`[${piId}] ← ${event}`);
  console.info(JSON.stringify(payload, null, 2));
}

function createMockPi(hardwareId: string): {
  socket: Socket<ServerToHardwareEvents, HardwareToServerEvents>;
  shutdown: () => void;
} {
  const startedAt = Date.now();
  let activeTransactionId: string | null = null;
  let activeZoneId: string | null = null;

  const socket: Socket<ServerToHardwareEvents, HardwareToServerEvents> = io(
    serverUrl,
    {
      transports: ["websocket"],
      auth: {
        role: "hardware",
        client_id: hardwareId,
      },
    },
  );

  socket.on("connect", () => {
    console.info(`[${hardwareId}] connected to ${serverUrl}`);
    sendHeartbeat();
  });

  socket.on("connect_error", (error) => {
    console.error(`[${hardwareId}] connection failed: ${error.message}`);
  });

  socket.on("disconnect", (reason) => {
    activeTransactionId = null;
    activeZoneId = null;
    console.warn(`[${hardwareId}] disconnected: ${reason}`);
  });

  socket.on("server-heartbeat", (payload) => {
    // Periodic; keep as a one-liner so command payloads stay readable.
    console.info(
      `[${hardwareId}] ← server-heartbeat sent_at_ms=${payload.sent_at_ms}`,
    );
  });

  socket.on("hardware-readiness-check", (payload, ack) => {
    logPayload(hardwareId, "hardware-readiness-check", payload);
    ack({
      transaction_id: payload.transaction_id,
      status: "ready",
      checked_at_ms: Date.now(),
    });
  });

  socket.on("hardware-apply-state", (payload, ack) => {
    logPayload(hardwareId, "hardware-apply-state", payload);

    applyAtRequestedTime(payload, () => {
      activeTransactionId = payload.lights.length
        ? payload.transaction_id
        : null;
      activeZoneId = payload.lights.length ? payload.zone_id : null;

      console.info(
        `[${hardwareId}] applied ${payload.scope} state: ` +
          `${payload.lights.length} light(s), zone=${payload.zone_id ?? "none"}`,
      );

      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
  });

  socket.on("hardware-emergency-shutdown", (payload) => {
    logPayload(hardwareId, "hardware-emergency-shutdown", payload);
    activeTransactionId = null;
    activeZoneId = null;
    socket.emit("emergency-shutdown-result", {
      pi_id: hardwareId,
      status: "safe",
      completed_at_ms: Date.now(),
    });
  });

  function applyAtRequestedTime(
    payload: HardwareApplyStatePayload,
    apply: () => void,
  ): void {
    const delay = Math.max(0, payload.execute_at_ms - Date.now());
    setTimeout(apply, delay);
  }

  function sendHeartbeat(): void {
    if (!socket.connected) return;

    socket.emit("hardware-heartbeat", {
      pi_id: hardwareId,
      uptime_ms: Date.now() - startedAt,
      status: "ready",
      active_transaction_id: activeTransactionId,
      active_zone_id: activeZoneId,
      sent_at_ms: Date.now(),
    });
  }

  const heartbeat = setInterval(sendHeartbeat, 5_000);

  return {
    socket,
    shutdown: () => {
      clearInterval(heartbeat);
      socket.disconnect();
    },
  };
}

const hardwareIds = resolveHardwareIds();
console.info(
  `[mock-hardware] starting ${hardwareIds.length} mock Pi(s): ${hardwareIds.join(", ")}`,
);

const mocks = hardwareIds.map(createMockPi);

function shutdown(signal: string): void {
  console.info(`[mock-hardware] received ${signal}; shutting down`);
  for (const mock of mocks) mock.shutdown();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
