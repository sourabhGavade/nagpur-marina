import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { io as createClient, type Socket } from "socket.io-client";
import { createSocketServer, type SocketServer } from "../lib/server.ts";
import type { HardwareApplyStatePayload } from "../utils/types.ts";

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

function acknowledgeHardwareApply(socket: Socket): void {
  socket.on(
    "hardware-apply-state",
    (payload: { transaction_id: string }, ack: (result: unknown) => void) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
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
  let hardware2: Socket;
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
    hardware2 = connect({
      role: "hardware",
      client_id: "raspberry-pi-2",
    });
    display = connect({
      role: "display",
      client_id: "large-monitor-1",
    });

    acknowledgeReadiness(hardware, "hardware-readiness-check");
    acknowledgeReadiness(hardware2, "hardware-readiness-check");
    acknowledgeReadiness(display, "display-readiness-check");

    // Consume connect-time idle apply so later `.once` listeners see command payloads.
    const connectIdle = Promise.all([
      new Promise<void>((resolve) => {
        hardware.once("hardware-apply-state", (payload, ack) => {
          ack({
            transaction_id: payload.transaction_id,
            status: "success",
            applied_at_ms: Date.now(),
          });
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        hardware2.once("hardware-apply-state", (payload, ack) => {
          ack({
            transaction_id: payload.transaction_id,
            status: "success",
            applied_at_ms: Date.now(),
          });
          resolve();
        });
      }),
    ]);

    tablet.connect();
    hardware.connect();
    hardware2.connect();
    display.connect();

    await waitUntil(
      () =>
        server.runtime.state.isOnline("hardware") &&
        server.runtime.state.isOnline("display"),
    );
    await connectIdle;
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

  function waitForSharedHardwareApply(): Promise<
    [HardwareApplyStatePayload, HardwareApplyStatePayload]
  > {
    return Promise.all([
      new Promise<HardwareApplyStatePayload>((resolve) => {
        hardware.once("hardware-apply-state", (payload, ack) => {
          ack({
            transaction_id: payload.transaction_id,
            status: "success",
            applied_at_ms: Date.now(),
          });
          resolve(payload);
        });
      }),
      new Promise<HardwareApplyStatePayload>((resolve) => {
        hardware2.once("hardware-apply-state", (payload, ack) => {
          ack({
            transaction_id: payload.transaction_id,
            status: "success",
            applied_at_ms: Date.now(),
          });
          resolve(payload);
        });
      }),
    ]);
  }

  test("activates all Sub-Zones and video for one Zone", async () => {
    acknowledgeVideoPreparation();

    const hardwareState = waitForSharedHardwareApply();
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
      tablet.emit(
        "zone-activation",
        { zone_id: "ambient-marina-state" },
        resolve,
      );
    });

    const [command, [hardwarePayload, hardware2Payload], videoPayload] =
      await Promise.all([result, hardwareState, videoState]);

    expect(command.status).toBe("success");
    expect(
      hardwarePayload.lights.every((light) => light.model === "main-model"),
    ).toBe(true);
    expect(
      hardware2Payload.lights.every(
        (light) => light.model === "clubhouse-model",
      ),
    ).toBe(true);
    expect(hardwarePayload.lights).toHaveLength(3);
    expect(hardware2Payload.lights).toHaveLength(8);
    expect(hardwarePayload.execute_at_ms).toBe(videoPayload.execute_at_ms);
    expect(server.runtime.state.mode).toBe("zone");
    expect(server.runtime.state.activeZoneId).toBe("ambient-marina-state");
  });

  test("controls one Sub-Zone and plays its parent video", async () => {
    acknowledgeVideoPreparation();

    const hardwareState = new Promise<HardwareApplyStatePayload>((resolve) => {
      hardware.once("hardware-apply-state", (payload, ack) => {
        ack({
          transaction_id: payload.transaction_id,
          status: "success",
          applied_at_ms: Date.now(),
        });
        resolve(payload);
      });
    });
    let pi2Seen = false;
    hardware2.once("hardware-apply-state", (_payload, ack) => {
      pi2Seen = true;
      ack({
        transaction_id: _payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
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
          zone_id: "ambient-marina-state",
          element_id: "sub_zone_10",
          model: "main-model",
          action: "activate",
          intensity: 0.55,
          animation_duration_ms: 300,
        },
        resolve,
      );
    });
    const payload = await hardwareState;
    await Bun.sleep(30);

    expect(result.status).toBe("success");
    expect(payload.scope).toBe("subzone");
    expect(payload.lights).toEqual([
      {
        element_id: "sub_zone_10",
        model: "main-model",
        action: "activate",
        intensity: 0.55,
        animation_duration_ms: 300,
      },
    ]);
    expect(pi2Seen).toBe(false);
    expect(server.runtime.state.mode).toBe("subzone");
  });

  test("prevents an overridden operation from dispatching stale state", async () => {
    let releaseFirstPreparation!: () => void;
    const firstPrepared = new Promise<void>((resolve) => {
      display.on("prepare-video", (payload, ack) => {
        if (payload.zone_id === "ambient-marina-state") {
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
    acknowledgeHardwareApply(hardware);
    acknowledgeHardwareApply(hardware2);
    hardware.on("hardware-apply-state", (payload) => {
      appliedZones.push(payload.zone_id ?? "system");
    });
    display.on("play-video-transition", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        started_at_ms: Date.now(),
      });
    });

    const firstResult = new Promise<any>((resolve) => {
      tablet.emit(
        "zone-activation",
        { zone_id: "ambient-marina-state" },
        resolve,
      );
    });
    await firstPrepared;

    const secondResult = new Promise<any>((resolve) => {
      tablet.emit(
        "zone-activation",
        { zone_id: "masterplan-reveal" },
        resolve,
      );
    });
    await waitUntil(
      () => server.runtime.state.activeZoneId === "masterplan-reveal",
    );
    releaseFirstPreparation();

    expect((await secondResult).status).toBe("success");
    expect((await firstResult).status).toBe("error");
    expect(appliedZones).toEqual(["masterplan-reveal"]);
  });

  test("stops video and applies idle lights", async () => {
    let idlePayload: HardwareApplyStatePayload | undefined;
    hardware.on("hardware-apply-state", (payload, ack) => {
      idlePayload = payload;
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    acknowledgeHardwareApply(hardware2);
    let stopPayload: { hold_last_frame_ms?: number } | undefined;
    display.once("stop-video", (payload, ack) => {
      stopPayload = payload;
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        stopped_at_ms: Date.now(),
      });
    });

    server.runtime.state.mode = "zone";
    server.runtime.state.activeAreaId = 1;
    server.runtime.state.activeZoneId = "masterplan-reveal";

    display.once("mute-video", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        muted_at_ms: Date.now(),
      });
    });
    const muteResult = await new Promise<any>((resolve) => {
      tablet.emit("sequence-mute", resolve);
    });
    expect(muteResult.status).toBe("success");
    expect(server.runtime.getRuntimeStatus().muted).toBe(true);

    const result = await new Promise<any>((resolve) => {
      tablet.emit("sequence-stop", resolve);
    });

    expect(result.status).toBe("success");
    expect(server.runtime.state.mode as string).toBe("idle");
    expect(server.runtime.state.activeZoneId).toBeNull();
    expect(server.runtime.state.activeAreaId).toBeNull();
    expect(stopPayload?.hold_last_frame_ms).toBeUndefined();
    expect(server.runtime.getRuntimeStatus().muted).toBe(false);
    expect(idlePayload?.scope).toBe("system");
    expect(idlePayload?.mode).toBe("idle");
    expect(idlePayload?.area_id).toBeNull();
    expect(idlePayload?.zone_id).toBeNull();
    expect(idlePayload?.lighting_id).toBeNull();
    expect(idlePayload?.lights.length).toBeGreaterThan(0);
    expect(
      idlePayload?.lights.every(
        (light) =>
          light.model === "main-model" && light.action === "activate",
      ),
    ).toBe(true);
  });

  test("broadcasts emergency shutdown repeatedly to both Pis", async () => {
    let emergencyCount = 0;
    hardware.on("hardware-emergency-shutdown", () => {
      emergencyCount += 1;
    });
    hardware2.on("hardware-emergency-shutdown", () => {
      emergencyCount += 1;
    });
    acknowledgeHardwareApply(hardware);
    acknowledgeHardwareApply(hardware2);
    display.once("stop-video", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        stopped_at_ms: Date.now(),
      });
    });

    tablet.emit("global-emergency-stop");
    await Bun.sleep(50);

    expect(emergencyCount).toBe(6);
    expect(server.runtime.state.mode).toBe("idle");
  });

  test("clear-lights sends empty fail-safe payload to both Pis", async () => {
    const payloads: HardwareApplyStatePayload[] = [];

    hardware.on("hardware-apply-state", (payload, ack) => {
      payloads.push(payload);
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    hardware2.on("hardware-apply-state", (payload, ack) => {
      payloads.push(payload);
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });

    server.runtime.state.mode = "zone";
    server.runtime.state.activeAreaId = 1;
    server.runtime.state.activeZoneId = "masterplan-reveal";

    const result = await new Promise<any>((resolve) => {
      tablet.emit("clear-lights", resolve);
    });

    expect(result.status).toBe("success");
    expect(payloads).toHaveLength(2);
    expect(
      payloads.every(
        (payload) =>
          payload.scope === "system" &&
          payload.mode === "replace" &&
          payload.lights.length === 0 &&
          payload.area_id === null &&
          payload.zone_id === null &&
          payload.lighting_id === null,
      ),
    ).toBe(true);
    expect(server.runtime.state.mode as string).toBe("idle");
    expect(server.runtime.state.activeZoneId).toBeNull();
  });

  test("routes main-model lighting only to raspberry-pi-1", async () => {
    let pi1Payload: HardwareApplyStatePayload | undefined;
    let pi2Seen = false;

    hardware.once("hardware-apply-state", (payload, ack) => {
      pi1Payload = payload;
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    hardware2.once("hardware-apply-state", (_payload, ack) => {
      pi2Seen = true;
      ack({
        transaction_id: _payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });

    const result = await new Promise<any>((resolve) => {
      tablet.emit(
        "lighting-control",
        { lighting_id: "marina-reserve", action: "activate" },
        resolve,
      );
    });

    await Bun.sleep(30);

    expect(result.status).toBe("success");
    expect(pi2Seen).toBe(false);
    expect(pi1Payload).toBeDefined();
    expect(pi1Payload!.lighting_id).toBe("marina-reserve");
    expect(pi1Payload!.scope).toBe("lighting");
    expect(pi1Payload!.lights).toHaveLength(2);
    expect(
      pi1Payload!.lights.every((light) => light.action === "activate"),
    ).toBe(true);
    expect(
      pi1Payload!.lights.every((light) => light.model === "main-model"),
    ).toBe(true);
    expect(server.runtime.state.activeLightingId).toBe("marina-reserve");
  });

  test("routes clubhouse lighting only to raspberry-pi-2", async () => {
    let pi2Payload: HardwareApplyStatePayload | undefined;
    let pi1Seen = false;

    hardware.once("hardware-apply-state", (_payload, ack) => {
      pi1Seen = true;
      ack({
        transaction_id: _payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    hardware2.once("hardware-apply-state", (payload, ack) => {
      pi2Payload = payload;
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });

    const result = await new Promise<any>((resolve) => {
      tablet.emit(
        "lighting-control",
        { lighting_id: "beach", action: "deactivate" },
        resolve,
      );
    });

    await Bun.sleep(30);

    expect(result.status).toBe("success");
    expect(pi1Seen).toBe(false);
    expect(pi2Payload).toBeDefined();
    expect(pi2Payload!.lighting_id).toBe("beach");
    expect(
      pi2Payload!.lights.every((light) => light.action === "deactivate"),
    ).toBe(true);
    expect(
      pi2Payload!.lights.every((light) => light.model === "clubhouse-model"),
    ).toBe(true);
  });
});
