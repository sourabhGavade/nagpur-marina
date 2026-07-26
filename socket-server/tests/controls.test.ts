import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { io as createClient, type Socket } from "socket.io-client";
import { createSocketServer, type SocketServer } from "../lib/server.ts";

function acknowledgeReadiness(
  socket: Socket,
  event: "hardware-readiness-check" | "display-readiness-check",
): void {
  socket.on(
    event,
    (payload: { transaction_id: string }, ack: (result: unknown) => void) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "ready",
        checked_at_ms: Date.now(),
      });
    },
  );
}

async function waitUntil(
  condition: () => boolean,
  timeoutMs = 1_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error("Condition timed out");
    await Bun.sleep(5);
  }
}

describe("Tablet controls", () => {
  let server: SocketServer;
  let url: string;
  let tablet: Socket;
  let hardware: Socket;
  let display: Socket;
  const clients: Socket[] = [];

  beforeEach(async () => {
    server = createSocketServer({
      runtime: {
        heartbeatIntervalMs: 1_000,
        heartbeatTimeoutMs: 5_000,
        readinessTimeoutMs: 250,
        safeCommandTimeoutMs: 250,
        mediaCommandTimeoutMs: 250,
        executionLeadMs: 25,
      },
      controls: {
        emergencyBroadcastCount: 3,
        emergencyBroadcastIntervalMs: 10,
      },
    });
    const port = await server.listen(0, "127.0.0.1");
    url = `http://127.0.0.1:${port}`;

    tablet = connect({ role: "tablet", client_id: "tablet-1" });
    hardware = connect({
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    display = connect({
      role: "display",
      client_id: "large-monitor-1",
    });

    acknowledgeReadiness(hardware, "hardware-readiness-check");
    acknowledgeReadiness(display, "display-readiness-check");

    tablet.connect();
    hardware.connect();
    display.connect();

    await waitUntil(
      () =>
        server.runtime.state.isOnline("hardware") &&
        server.runtime.state.isOnline("display"),
    );
  });

  afterEach(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  function connect(auth: Record<string, unknown>): Socket {
    const socket = createClient(url, {
      auth,
      autoConnect: false,
      forceNew: true,
      transports: ["websocket"],
    });
    clients.push(socket);
    return socket;
  }

  function acknowledgeVideoPreparation(): void {
    display.on(
      "prepare-video",
      (payload: { transaction_id: string }, ack: (result: unknown) => void) => {
        ack({
          transaction_id: payload.transaction_id,
          status: "ready",
          prepared_at_ms: Date.now(),
        });
      },
    );
  }

  test("activates all Sub-Zones and video for one Zone", async () => {
    acknowledgeVideoPreparation();

    const hardwareState = new Promise<any>((resolve) => {
      hardware.once("hardware-apply-state", (payload, ack) => {
        ack({
          transaction_id: payload.transaction_id,
          status: "success",
          applied_at_ms: Date.now(),
        });
        resolve(payload);
      });
    });
    const videoState = new Promise<any>((resolve) => {
      display.once("play-video-transition", (payload, ack) => {
        ack({
          transaction_id: payload.transaction_id,
          status: "success",
          started_at_ms: Date.now(),
        });
        resolve(payload);
      });
    });
    const result = new Promise<any>((resolve) => {
      tablet.emit("zone-activation", { zone_id: "foyer-welcome" }, resolve);
    });

    const [command, hardwarePayload, videoPayload] = await Promise.all([
      result,
      hardwareState,
      videoState,
    ]);

    expect(command.status).toBe("success");
    expect(hardwarePayload.lights).toHaveLength(2);
    expect(hardwarePayload.execute_at_ms).toBe(videoPayload.execute_at_ms);
    expect(server.runtime.state.mode).toBe("zone");
    expect(server.runtime.state.activeZoneId).toBe("foyer-welcome");
  });

  test("controls one Sub-Zone and plays its parent video", async () => {
    acknowledgeVideoPreparation();

    const hardwareState = new Promise<any>((resolve) => {
      hardware.once("hardware-apply-state", (payload, ack) => {
        ack({
          transaction_id: payload.transaction_id,
          status: "success",
          applied_at_ms: Date.now(),
        });
        resolve(payload);
      });
    });
    display.once("play-video-transition", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        started_at_ms: Date.now(),
      });
    });

    const result = await new Promise<any>((resolve) => {
      tablet.emit(
        "subzone-control",
        {
          zone_id: "foyer-welcome",
          element_id: "foyer_accent",
          action: "activate",
          intensity: 0.55,
          animation_duration_ms: 300,
        },
        resolve,
      );
    });
    const payload = await hardwareState;

    expect(result.status).toBe("success");
    expect(payload.scope).toBe("subzone");
    expect(payload.lights).toEqual([
      {
        element_id: "foyer_accent",
        action: "activate",
        intensity: 0.55,
        animation_duration_ms: 300,
      },
    ]);
    expect(server.runtime.state.mode).toBe("subzone");
  });

  test("prevents an overridden operation from dispatching stale state", async () => {
    let releaseFirstPreparation!: () => void;
    const firstPrepared = new Promise<void>((resolve) => {
      display.on("prepare-video", (payload, ack) => {
        if (payload.zone_id === "foyer-welcome") {
          releaseFirstPreparation = () => {
            ack({
              transaction_id: payload.transaction_id,
              status: "ready",
              prepared_at_ms: Date.now(),
            });
          };
          resolve();
          return;
        }

        ack({
          transaction_id: payload.transaction_id,
          status: "ready",
          prepared_at_ms: Date.now(),
        });
      });
    });

    const appliedZones: string[] = [];
    hardware.on("hardware-apply-state", (payload, ack) => {
      appliedZones.push(payload.zone_id ?? "system");
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    display.on("play-video-transition", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        started_at_ms: Date.now(),
      });
    });

    const firstResult = new Promise<any>((resolve) => {
      tablet.emit("zone-activation", { zone_id: "foyer-welcome" }, resolve);
    });
    await firstPrepared;

    const secondResult = new Promise<any>((resolve) => {
      tablet.emit("zone-activation", { zone_id: "corridor-reveal" }, resolve);
    });
    await waitUntil(
      () => server.runtime.state.activeZoneId === "corridor-reveal",
    );
    releaseFirstPreparation();

    expect((await secondResult).status).toBe("success");
    expect((await firstResult).status).toBe("error");
    expect(appliedZones).toEqual(["corridor-reveal"]);
  });

  test("stops video and switches every output off", async () => {
    hardware.once("hardware-apply-state", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    display.once("stop-video", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        stopped_at_ms: Date.now(),
      });
    });

    const result = await new Promise<any>((resolve) => {
      tablet.emit("sequence-stop", resolve);
    });

    expect(result.status).toBe("success");
    expect(server.runtime.state.mode).toBe("idle");
  });

  test("broadcasts emergency shutdown repeatedly", async () => {
    let emergencyCount = 0;
    hardware.on("hardware-emergency-shutdown", () => {
      emergencyCount += 1;
    });
    hardware.once("hardware-apply-state", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    display.once("stop-video", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        stopped_at_ms: Date.now(),
      });
    });

    tablet.emit("global-emergency-stop");
    await Bun.sleep(50);

    expect(emergencyCount).toBe(3);
    expect(server.runtime.state.mode).toBe("idle");
  });
});
