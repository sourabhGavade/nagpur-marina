import { io, type Socket } from "socket.io-client";
import type {
  HardwareApplyStatePayload,
  HardwareToServerEvents,
  ServerToHardwareEvents,
} from "../utils/types.ts";

const serverUrl = Bun.env.SOCKET_SERVER_URL ?? "http://127.0.0.1:4000";
const hardwareId = Bun.env.MOCK_HARDWARE_ID ?? "mock-hardware-home";
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
  console.info(`[mock-hardware] connected to ${serverUrl}`);
});

socket.on("connect_error", (error) => {
  console.error(`[mock-hardware] connection failed: ${error.message}`);
});

socket.on("disconnect", (reason) => {
  activeTransactionId = null;
  activeZoneId = null;
  console.warn(`[mock-hardware] disconnected: ${reason}`);
});

socket.on("hardware-readiness-check", (payload, ack) => {
  console.info("[mock-hardware] readiness check");
  ack({
    transaction_id: payload.transaction_id,
    status: "ready",
    checked_at_ms: Date.now(),
  });
});

socket.on("hardware-apply-state", (payload, ack) => {
  applyAtRequestedTime(payload, () => {
    activeTransactionId = payload.lights.length
      ? payload.transaction_id
      : null;
    activeZoneId = payload.lights.length ? payload.zone_id : null;

    console.info(
      `[mock-hardware] applied ${payload.scope} state: ` +
        `${payload.lights.length} light(s), zone=${payload.zone_id ?? "none"}`,
    );

    ack({
      transaction_id: payload.transaction_id,
      status: "success",
      applied_at_ms: Date.now(),
    });
  });
});

socket.on("hardware-emergency-shutdown", () => {
  activeTransactionId = null;
  activeZoneId = null;
  console.warn("[mock-hardware] emergency shutdown received");
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
socket.on("connect", sendHeartbeat);

function shutdown(signal: string): void {
  console.info(`[mock-hardware] received ${signal}; shutting down`);
  clearInterval(heartbeat);
  socket.disconnect();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
