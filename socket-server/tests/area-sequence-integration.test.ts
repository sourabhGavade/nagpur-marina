import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { io as createClient, type Socket } from "socket.io-client";
import { createSocketServer, type SocketServer } from "../lib/server.ts";
import { config } from "../utils/config.ts";

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

describe("continuous Area sequence", () => {
  let server: SocketServer;
  let tablet: Socket;
  let hardware: Socket;
  let hardware2: Socket;
  let display: Socket;
  const clients: Socket[] = [];
  const appliedZones: string[] = [];
  const executionTimes: number[] = [];

  beforeEach(async () => {
    const shortConfig = structuredClone(config);
    for (const area of shortConfig.areas) {
      for (const zone of area.zones) {
        zone.video_duration_ms = 80;
        zone.video_crossfade_duration_ms = 20;
      }
    }

    server = createSocketServer({
      appConfig: shortConfig,
      runtime: {
        heartbeatIntervalMs: 1_000,
        heartbeatTimeoutMs: 5_000,
        readinessTimeoutMs: 250,
        mediaCommandTimeoutMs: 250,
        executionLeadMs: 5,
      },
    });
    const port = await server.listen(0, "127.0.0.1");
    const url = `http://127.0.0.1:${port}`;

    tablet = connect(url, { role: "tablet", client_id: "tablet-1" });
    hardware = connect(url, {
      role: "hardware",
      client_id: "raspberry-pi-1",
    });
    hardware2 = connect(url, {
      role: "hardware",
      client_id: "raspberry-pi-2",
    });
    display = connect(url, {
      role: "display",
      client_id: "large-monitor-1",
    });

    acknowledgeReadiness(hardware, "hardware-readiness-check");
    acknowledgeReadiness(hardware2, "hardware-readiness-check");
    acknowledgeReadiness(display, "display-readiness-check");
    display.on("prepare-video", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "ready",
        prepared_at_ms: Date.now(),
      });
    });
    hardware.on("hardware-apply-state", (payload, ack) => {
      if (payload.zone_id) {
        appliedZones.push(payload.zone_id);
        executionTimes.push(payload.execute_at_ms);
      }
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        applied_at_ms: Date.now(),
      });
    });
    hardware2.on("hardware-apply-state", (payload, ack) => {
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
    display.on("pause-video", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        paused_at_ms: Date.now(),
      });
    });
    display.on("resume-video", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        resumed_at_ms: Date.now(),
      });
    });

    tablet.connect();
    hardware.connect();
    hardware2.connect();
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
    appliedZones.length = 0;
    executionTimes.length = 0;
    clients.length = 0;
  });

  function connect(
    url: string,
    auth: Record<string, unknown>,
  ): Socket {
    const socket = createClient(url, {
      auth,
      autoConnect: false,
      forceNew: true,
      transports: ["websocket"],
    });
    clients.push(socket);
    return socket;
  }

  function acknowledgeReadiness(
    socket: Socket,
    event: "hardware-readiness-check" | "display-readiness-check",
  ): void {
    socket.on(event, (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "ready",
        checked_at_ms: Date.now(),
      });
    });
  }

  test("continues through later Areas and wraps to the first", async () => {
    const result = await new Promise<any>((resolve) => {
      tablet.emit("area-activation", { area_id: 2 }, resolve);
    });

    expect(result.status).toBe("success");
    await waitUntil(() => appliedZones.length >= 4);

    expect(appliedZones.slice(0, 4)).toEqual([
      "gallery-showcase",
      "lounge-finale",
      "foyer-welcome",
      "corridor-reveal",
    ]);
    const firstTransitionDelay = executionTimes[1]! - executionTimes[0]!;
    expect(firstTransitionDelay).toBeGreaterThanOrEqual(60);
    expect(firstTransitionDelay).toBeLessThan(120);
    expect(server.runtime.state.mode).toBe("area");
  });

  test("pauses Area timing and resumes with the remaining delay", async () => {
    const startResult = await new Promise<any>((resolve) => {
      tablet.emit("area-activation", { area_id: 1 }, resolve);
    });
    expect(startResult.status).toBe("success");

    const pauseResult = await new Promise<any>((resolve) => {
      tablet.emit("sequence-pause", resolve);
    });
    expect(pauseResult.status).toBe("success");
    expect(server.runtime.state.paused).toBe(true);

    const countWhilePaused = appliedZones.length;
    await Bun.sleep(120);
    expect(appliedZones).toHaveLength(countWhilePaused);

    const resumeResult = await new Promise<any>((resolve) => {
      tablet.emit("sequence-resume", resolve);
    });
    expect(resumeResult.status).toBe("success");
    expect(server.runtime.state.paused).toBe(false);

    await waitUntil(() => appliedZones.length > countWhilePaused);
  });

  test("stops dispatching when a Zone override invalidates the loop", async () => {
    const areaResult = await new Promise<any>((resolve) => {
      tablet.emit("area-activation", { area_id: 1 }, resolve);
    });
    expect(areaResult.status).toBe("success");

    const zoneResult = await new Promise<any>((resolve) => {
      tablet.emit(
        "zone-activation",
        { zone_id: "gallery-showcase" },
        resolve,
      );
    });
    expect(zoneResult.status).toBe("success");

    const dispatchCountAfterOverride = appliedZones.length;
    await Bun.sleep(100);

    expect(appliedZones).toHaveLength(dispatchCountAfterOverride);
    expect(server.runtime.state.mode).toBe("zone");
    expect(server.runtime.state.activeZoneId).toBe("gallery-showcase");
  });
});
