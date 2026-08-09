import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { io as createClient, type Socket } from "socket.io-client";
import { createSocketServer, type SocketServer } from "../lib/server.ts";
import { config } from "../utils/config.ts";
import type { HardwareApplyStatePayload } from "../utils/types.ts";

const TEST_IDLE_HOLD_MS = 50;

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
  const stopPayloads: Array<{
    transaction_id: string;
    hold_last_frame_ms?: number;
  }> = [];
  const idlePayloads: HardwareApplyStatePayload[] = [];
  const muteEvents: string[] = [];
  let latestRuntimeStatus: { muted?: boolean } | null = null;

  beforeEach(async () => {
    appliedZones.length = 0;
    executionTimes.length = 0;
    stopPayloads.length = 0;
    idlePayloads.length = 0;
    muteEvents.length = 0;
    latestRuntimeStatus = null;

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
        idleHoldLastFrameMs: TEST_IDLE_HOLD_MS,
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
      if (payload.mode === "idle") {
        idlePayloads.push(payload);
      } else if (payload.zone_id) {
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
      if (payload.mode === "idle") {
        idlePayloads.push(payload);
      }
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
    display.on("mute-video", (payload, ack) => {
      muteEvents.push("mute-video");
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        muted_at_ms: Date.now(),
      });
    });
    display.on("unmute-video", (payload, ack) => {
      muteEvents.push("unmute-video");
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        unmuted_at_ms: Date.now(),
      });
    });
    display.on("stop-video", (payload, ack) => {
      stopPayloads.push(payload);
      console.log("STOP_DBG", JSON.stringify(payload));
      ack({
        transaction_id: payload.transaction_id,
        status: "success",
        stopped_at_ms: Date.now(),
      });
    });
    // tablet.on("runtime-status", (status) => {
    //   latestRuntimeStatus = status;
    // });

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
    stopPayloads.length = 0;
    idlePayloads.length = 0;
    muteEvents.length = 0;
    latestRuntimeStatus = null;
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

  test("plays Zones within the selected Area and stops at the end", async () => {
    const result = await new Promise<any>((resolve) => {
      tablet.emit("area-activation", { area_id: 1 }, resolve);
    });

    expect(result.status).toBe("success");
    await waitUntil(() => appliedZones.length >= 2);

    expect(appliedZones.slice(0, 2)).toEqual([
      "why-nagpur-marina",
      "masterplan-reveal",
    ]);
    const firstTransitionDelay = executionTimes[1]! - executionTimes[0]!;
    expect(firstTransitionDelay).toBeGreaterThanOrEqual(60);
    expect(firstTransitionDelay).toBeLessThan(120);
    expect(server.runtime.state.mode).toBe("area");
    expect(server.runtime.state.activeZoneId).toBe("masterplan-reveal");

    await waitUntil(() => server.runtime.state.mode === "idle", 1_500);
    expect(server.runtime.state.activeAreaId).toBe(1);
    expect(server.runtime.state.activeZoneId).toBe("masterplan-reveal");
    expect(stopPayloads.at(-1)?.hold_last_frame_ms).toBe(TEST_IDLE_HOLD_MS);
    expect(appliedZones).not.toContain("lifestyle-anchors-intro");

    await waitUntil(() => idlePayloads.length >= 2, 1_000);
    expect(idlePayloads.every((payload) => payload.mode === "idle")).toBe(true);
    expect(idlePayloads.every((payload) => payload.scope === "system")).toBe(
      true,
    );
    expect(idlePayloads.some((payload) => payload.lights.length > 0)).toBe(
      true,
    );
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

  test("plays one Zone once and returns to idle when finished", async () => {
    let loopFlag: boolean | undefined;
    display.once("play-video-transition", (payload) => {
      loopFlag = payload.loop;
    });

    const result = await new Promise<any>((resolve) => {
      tablet.emit(
        "zone-activation",
        { zone_id: "why-nagpur-marina" },
        resolve,
      );
    });

    expect(result.status).toBe("success");
    expect(server.runtime.state.mode).toBe("zone");
    expect(server.runtime.state.activeZoneId).toBe("why-nagpur-marina");
    expect(loopFlag).toBe(false);

    await waitUntil(() => server.runtime.state.mode === "idle", 1_500);
    expect(server.runtime.state.activeZoneId).toBe("why-nagpur-marina");
    expect(stopPayloads.at(-1)?.hold_last_frame_ms).toBe(TEST_IDLE_HOLD_MS);

    await waitUntil(() => idlePayloads.length >= 2, 1_000);
    expect(idlePayloads.every((payload) => payload.mode === "idle")).toBe(true);
  });

  test("rejects Zone activation while an Area sequence is playing", async () => {
    const areaResult = await new Promise<any>((resolve) => {
      tablet.emit("area-activation", { area_id: 1 }, resolve);
    });
    expect(areaResult.status).toBe("success");
    await waitUntil(() => appliedZones.length >= 1);
    expect(server.runtime.state.mode).toBe("area");

    const zoneResult = await new Promise<any>((resolve) => {
      tablet.emit(
        "zone-activation",
        { zone_id: "lifestyle-anchors-intro" },
        resolve,
      );
    });
    expect(zoneResult.status).toBe("error");
    expect(zoneResult.message).toContain("Area sequence");
    expect(server.runtime.state.mode).toBe("area");
    expect(appliedZones).not.toContain("lifestyle-anchors-intro");
  });

  test("mutes and unmutes display audio without stopping playback", async () => {
    const startResult = await new Promise<any>((resolve) => {
      tablet.emit(
        "zone-activation",
        { zone_id: "why-nagpur-marina" },
        resolve,
      );
    });
    expect(startResult.status).toBe("success");
    await waitUntil(() => server.runtime.state.mode === "zone");

    const muteResult = await new Promise<any>((resolve) => {
      tablet.emit("sequence-mute", resolve);
    });
    expect(muteResult.status).toBe("success");
    expect(muteEvents).toContain("mute-video");
    expect(server.runtime.getRuntimeStatus().muted).toBe(true);
    await waitUntil(() => latestRuntimeStatus?.muted === true);

    const unmuteResult = await new Promise<any>((resolve) => {
      tablet.emit("sequence-unmute", resolve);
    });
    expect(unmuteResult.status).toBe("success");
    expect(muteEvents).toContain("unmute-video");
    expect(server.runtime.getRuntimeStatus().muted).toBe(false);
    await waitUntil(() => latestRuntimeStatus?.muted === false);
    expect(server.runtime.state.mode).toBe("zone");
  });
});
