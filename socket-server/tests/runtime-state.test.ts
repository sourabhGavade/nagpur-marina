import { describe, expect, test } from "bun:test";
import { RuntimeState } from "../lib/runtime-state.ts";

describe("RuntimeState", () => {
  test("requires connection and readiness before a node is online", () => {
    const state = new RuntimeState();

    expect(state.isOnline("hardware")).toBe(false);
    state.markConnected("hardware");
    expect(state.isOnline("hardware")).toBe(false);
    state.markReady("hardware");
    expect(state.isOnline("hardware")).toBe(true);
  });

  test("tracks heartbeat expiry", () => {
    const state = new RuntimeState();
    state.markConnected("display", 1_000);
    state.markHeartbeat("display", 500, "ready", 2_000);

    expect(state.isHeartbeatExpired("display", 31_999, 30_000)).toBe(false);
    expect(state.isHeartbeatExpired("display", 32_000, 30_000)).toBe(true);
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
