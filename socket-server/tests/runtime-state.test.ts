import { describe, expect, test } from "bun:test";
import { RuntimeState } from "../lib/runtime-state.ts";

describe("RuntimeState", () => {
  test("requires both hardware clients connected and ready before online", () => {
    const state = new RuntimeState();

    expect(state.isOnline("hardware")).toBe(false);

    state.markHardwareConnected("raspberry-pi-1");
    state.markHardwareReady("raspberry-pi-1");
    expect(state.isOnline("hardware")).toBe(false);

    state.markHardwareConnected("raspberry-pi-2");
    expect(state.isOnline("hardware")).toBe(false);

    state.markHardwareReady("raspberry-pi-2");
    expect(state.isOnline("hardware")).toBe(true);
  });

  test("goes offline when one hardware client disconnects", () => {
    const state = new RuntimeState();
    state.markHardwareConnected("raspberry-pi-1");
    state.markHardwareReady("raspberry-pi-1");
    state.markHardwareConnected("raspberry-pi-2");
    state.markHardwareReady("raspberry-pi-2");

    expect(state.isOnline("hardware")).toBe(true);
    state.markHardwareDisconnected("raspberry-pi-1");
    expect(state.isOnline("hardware")).toBe(false);
  });

  test("tracks heartbeat expiry per hardware client and display", () => {
    const state = new RuntimeState();
    state.markHardwareConnected("raspberry-pi-1", 1_000);
    state.markHardwareHeartbeat("raspberry-pi-1", 500, "ready", 2_000);
    state.markDisplayConnected(1_000);
    state.markDisplayHeartbeat(500, "ready", 2_000);

    expect(
      state.isHardwareHeartbeatExpired("raspberry-pi-1", 31_999, 30_000),
    ).toBe(false);
    expect(
      state.isHardwareHeartbeatExpired("raspberry-pi-1", 32_000, 30_000),
    ).toBe(true);
    expect(state.isDisplayHeartbeatExpired(31_999, 30_000)).toBe(false);
    expect(state.isDisplayHeartbeatExpired(32_000, 30_000)).toBe(true);
  });

  test("invalidates active work and transaction state", () => {
    const state = new RuntimeState();
    const generation = state.generation;
    state.mode = "zone";
    state.activeZoneId = "foyer-welcome";
    state.trackTransaction("transaction-1");

    state.invalidate();

    expect(state.isCurrent(generation)).toBe(false);
    expect(state.mode as string).toBe("idle");
    expect(state.activeZoneId).toBeNull();
    expect(state.activeTransactionIds.size).toBe(0);
  });

  test("resolves pending sequence waits as cancelled", async () => {
    const state = new RuntimeState();
    const generation = state.generation;
    const wait = state.waitFor(10_000, generation);

    state.invalidate();

    expect(await wait).toBe(false);
  });
});
