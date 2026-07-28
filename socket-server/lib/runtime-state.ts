import type { ClientRole } from "../utils/types.ts";
import { EXPECTED_HARDWARE_CLIENTS } from "./consts.ts";

export type NodeRole = Exclude<ClientRole, "tablet">;
export type RuntimeMode = "idle" | "area" | "zone" | "subzone" | "lighting";

export interface NodeHealth {
  connected: boolean;
  ready: boolean;
  lastHeartbeatAt: number | null;
  uptimeMs: number | null;
  reportedStatus: "ready" | "error" | null;
}

function createNodeHealth(): NodeHealth {
  return {
    connected: false,
    ready: false,
    lastHeartbeatAt: null,
    uptimeMs: null,
    reportedStatus: null,
  };
}

function isNodeOnline(node: NodeHealth): boolean {
  return node.connected && node.ready && node.reportedStatus !== "error";
}

interface PendingWait {
  timer: ReturnType<typeof setTimeout> | null;
  dueAt: number;
  remainingMs: number;
  generation: number;
  resolve: (current: boolean) => void;
}

export class RuntimeState {
  mode: RuntimeMode = "idle";
  activeAreaId: number | null = null;
  activeZoneId: string | null = null;
  activeLightingId: string | null = null;
  activeElementId: string | null = null;
  generation = 0;
  paused = false;

  readonly hardwareNodes = new Map<string, NodeHealth>();
  readonly display = createNodeHealth();
  readonly activeTransactionIds = new Set<string>();
  private readonly pendingWaits = new Set<PendingWait>();

  getHardwareNode(clientId: string): NodeHealth | undefined {
    return this.hardwareNodes.get(clientId);
  }

  getDisplayNode(): NodeHealth {
    return this.display;
  }

  markHardwareConnected(clientId: string, now = Date.now()): void {
    const node = this.hardwareNodes.get(clientId) ?? createNodeHealth();
    node.connected = true;
    node.ready = false;
    node.lastHeartbeatAt = now;
    node.uptimeMs = null;
    node.reportedStatus = null;
    this.hardwareNodes.set(clientId, node);
  }

  markDisplayConnected(now = Date.now()): void {
    this.display.connected = true;
    this.display.ready = false;
    this.display.lastHeartbeatAt = now;
    this.display.uptimeMs = null;
    this.display.reportedStatus = null;
  }

  markHardwareReady(clientId: string): void {
    const node = this.hardwareNodes.get(clientId);
    if (node?.connected) node.ready = true;
  }

  markDisplayReady(): void {
    if (this.display.connected) this.display.ready = true;
  }

  markHardwareUnavailable(clientId: string): void {
    const node = this.hardwareNodes.get(clientId);
    if (node) node.ready = false;
  }

  markDisplayUnavailable(): void {
    this.display.ready = false;
  }

  markHardwareHeartbeat(
    clientId: string,
    uptimeMs: number,
    status: "ready" | "error",
    now = Date.now(),
  ): void {
    const node = this.hardwareNodes.get(clientId);
    if (!node) return;
    node.lastHeartbeatAt = now;
    node.uptimeMs = uptimeMs;
    node.reportedStatus = status;
  }

  markDisplayHeartbeat(
    uptimeMs: number,
    status: "ready" | "error",
    now = Date.now(),
  ): void {
    this.display.lastHeartbeatAt = now;
    this.display.uptimeMs = uptimeMs;
    this.display.reportedStatus = status;
  }

  markHardwareDisconnected(clientId: string): void {
    this.hardwareNodes.delete(clientId);
  }

  markDisplayDisconnected(): void {
    Object.assign(this.display, createNodeHealth());
  }

  isOnline(role: NodeRole): boolean {
    if (role === "display") return isNodeOnline(this.display);

    if (this.hardwareNodes.size < EXPECTED_HARDWARE_CLIENTS) return false;
    return [...this.hardwareNodes.values()].every(isNodeOnline);
  }

  isHardwareHeartbeatExpired(
    clientId: string,
    now: number,
    timeoutMs: number,
  ): boolean {
    const node = this.hardwareNodes.get(clientId);
    return (
      !!node &&
      node.connected &&
      node.lastHeartbeatAt !== null &&
      now - node.lastHeartbeatAt >= timeoutMs
    );
  }

  isDisplayHeartbeatExpired(now: number, timeoutMs: number): boolean {
    return (
      this.display.connected &&
      this.display.lastHeartbeatAt !== null &&
      now - this.display.lastHeartbeatAt >= timeoutMs
    );
  }

  trackTransaction(transactionId: string): () => void {
    this.activeTransactionIds.add(transactionId);
    return () => this.activeTransactionIds.delete(transactionId);
  }

  waitFor(delayMs: number, generation: number): Promise<boolean> {
    if (!this.isCurrent(generation)) return Promise.resolve(false);

    return new Promise((resolve) => {
      const remainingMs = Math.max(0, delayMs);
      const wait: PendingWait = {
        timer: null,
        dueAt: Date.now() + remainingMs,
        remainingMs,
        generation,
        resolve,
      };

      this.pendingWaits.add(wait);
      if (!this.paused) this.scheduleWait(wait);
    });
  }

  pause(): boolean {
    if (this.paused || this.mode === "idle") return false;

    this.paused = true;
    const now = Date.now();

    for (const wait of this.pendingWaits) {
      if (!wait.timer) continue;
      clearTimeout(wait.timer);
      wait.timer = null;
      wait.remainingMs = Math.max(0, wait.dueAt - now);
    }

    return true;
  }

  resume(): boolean {
    if (!this.paused) return false;

    this.paused = false;
    for (const wait of this.pendingWaits) this.scheduleWait(wait);
    return true;
  }

  isCurrent(generation: number): boolean {
    return this.generation === generation;
  }

  invalidate(): number {
    this.generation += 1;
    this.mode = "idle";
    this.activeAreaId = null;
    this.activeZoneId = null;
    this.activeLightingId = null;
    this.activeElementId = null;
    this.paused = false;
    this.activeTransactionIds.clear();

    for (const wait of this.pendingWaits) {
      if (wait.timer) clearTimeout(wait.timer);
      wait.resolve(false);
    }
    this.pendingWaits.clear();

    return this.generation;
  }

  private scheduleWait(wait: PendingWait): void {
    if (
      this.paused ||
      wait.timer ||
      !this.pendingWaits.has(wait) ||
      !this.isCurrent(wait.generation)
    ) {
      return;
    }

    wait.dueAt = Date.now() + wait.remainingMs;
    wait.timer = setTimeout(() => {
      wait.timer = null;
      this.pendingWaits.delete(wait);
      wait.resolve(this.isCurrent(wait.generation));
    }, wait.remainingMs);
  }
}
