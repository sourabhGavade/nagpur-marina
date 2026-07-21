import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  io as createClient,
  type ManagerOptions,
  type Socket,
  type SocketOptions,
} from "socket.io-client";
import { createSocketServer, type SocketServer } from "../lib/server.ts";

type TestClient = Socket;

function once<T>(socket: TestClient, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

function waitForStatus(
  socket: TestClient,
  event: "hardware-status" | "display-status",
  online: boolean,
): Promise<{ online: boolean }> {
  return new Promise((resolve) => {
    const listener = (status: { online: boolean }) => {
      if (status.online !== online) return;
      socket.off(event, listener);
      resolve(status);
    };
    socket.on(event, listener);
  });
}

function acknowledgeReadiness(
  socket: TestClient,
  event: "hardware-readiness-check" | "display-readiness-check",
): void {
  socket.on(
    event,
    (
      payload: { transaction_id: string },
      ack: (result: unknown) => void,
    ) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "ready",
        checked_at_ms: Date.now(),
      });
    },
  );
}

describe("Socket.IO server foundation", () => {
  let server: SocketServer;
  let url: string;
  const clients: TestClient[] = [];

  beforeEach(async () => {
    server = createSocketServer({
      runtime: {
        heartbeatIntervalMs: 50,
        heartbeatTimeoutMs: 200,
        readinessTimeoutMs: 100,
        safeCommandTimeoutMs: 100,
      },
    });
    const port = await server.listen(0, "127.0.0.1");
    url = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  function client(
    auth: Record<string, unknown>,
    options: Partial<ManagerOptions & SocketOptions> = {},
  ): TestClient {
    const socket = createClient(url, {
      auth,
      autoConnect: false,
      forceNew: true,
      transports: ["websocket"],
      ...options,
    });
    clients.push(socket);
    return socket;
  }

  test("rejects an invalid client identity", async () => {
    const socket = client({ role: "unknown", client_id: "bad-client" });
    const errorPromise = once<Error & { data?: { error_code?: string } }>(
      socket,
      "connect_error",
    );

    socket.connect();
    const error = await errorPromise;

    expect(error.data?.error_code).toBe("invalid_handshake");
  });

  test("sends layout and current statuses to a Tablet", async () => {
    const socket = client({ role: "tablet", client_id: "tablet-1" });
    const layoutPromise = once<{ areas: unknown[] }>(socket, "system-layout");
    const hardwarePromise = once<{ online: boolean }>(
      socket,
      "hardware-status",
    );
    const displayPromise = once<{ online: boolean }>(socket, "display-status");

    socket.connect();
    const [layout, hardware, display] = await Promise.all([
      layoutPromise,
      hardwarePromise,
      displayPromise,
    ]);

    expect(layout.areas.length).toBeGreaterThan(0);
    expect(hardware.online).toBe(false);
    expect(display.online).toBe(false);
  });

  test("broadcasts hardware connection status to Tablets", async () => {
    const tablet = client({ role: "tablet", client_id: "tablet-1" });
    const tabletConnected = once(tablet, "connect");
    const initialHardware = once<{ online: boolean }>(
      tablet,
      "hardware-status",
    );
    tablet.connect();
    await Promise.all([tabletConnected, initialHardware]);

    const onlinePromise = waitForStatus(tablet, "hardware-status", true);

    const hardware = client({
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    acknowledgeReadiness(hardware, "hardware-readiness-check");
    hardware.connect();

    expect((await onlinePromise).online).toBe(true);
  });

  test("allows only one hardware client", async () => {
    const first = client({
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    acknowledgeReadiness(first, "hardware-readiness-check");
    const firstConnected = once(first, "connect");
    first.connect();
    await firstConnected;

    const second = client({
      role: "hardware",
      client_id: "raspberry-pi-2",
    });
    const errorPromise = once<Error & { data?: { error_code?: string } }>(
      second,
      "connect_error",
    );
    second.connect();

    expect((await errorPromise).data?.error_code).toBe("duplicate_client");
  });

  test("marks hardware offline after its heartbeat expires", async () => {
    const tablet = client({ role: "tablet", client_id: "tablet-1" });
    const initialStatus = once<{ online: boolean }>(
      tablet,
      "hardware-status",
    );
    tablet.connect();
    await initialStatus;

    const onlineStatus = waitForStatus(tablet, "hardware-status", true);
    const hardware = client({
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    acknowledgeReadiness(hardware, "hardware-readiness-check");
    hardware.connect();
    expect((await onlineStatus).online).toBe(true);

    const offlineStatus = waitForStatus(tablet, "hardware-status", false);
    expect((await offlineStatus).online).toBe(false);
  });

  test("sends periodic server heartbeats", async () => {
    const hardware = client({
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    acknowledgeReadiness(hardware, "hardware-readiness-check");
    const heartbeat = once<{ sent_at_ms: number }>(
      hardware,
      "server-heartbeat",
    );

    hardware.connect();

    expect((await heartbeat).sent_at_ms).toBeGreaterThan(0);
  });

  test("disconnects hardware that does not acknowledge readiness", async () => {
    const hardware = client({
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    const disconnected = once(hardware, "disconnect");

    hardware.connect();

    await disconnected;
    expect(server.runtime.state.hardware.connected).toBe(false);
    expect(server.runtime.state.isOnline("hardware")).toBe(false);
  });

  test("switches hardware off when the display disconnects", async () => {
    const hardware = client({
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    acknowledgeReadiness(hardware, "hardware-readiness-check");
    const hardwareConnected = once(hardware, "connect");
    hardware.connect();
    await hardwareConnected;

    const safeOff = new Promise<{ lights: unknown[] }>((resolve) => {
      hardware.once(
        "hardware-apply-state",
        (
          payload: { transaction_id: string; lights: unknown[] },
          ack: (result: unknown) => void,
        ) => {
          ack({
            transaction_id: payload.transaction_id,
            status: "success",
            applied_at_ms: Date.now(),
          });
          resolve(payload);
        },
      );
    });

    const display = client({
      role: "display",
      client_id: "large-monitor-1",
    });
    acknowledgeReadiness(display, "display-readiness-check");
    const displayConnected = once(display, "connect");
    display.connect();
    await displayConnected;
    display.disconnect();

    expect((await safeOff).lights).toEqual([]);
    await Bun.sleep(10);
    expect(server.runtime.state.mode).toBe("idle");
  });
});
