import type { ClientRole } from "../utils/types.ts";

export type NodeRole = Exclude<ClientRole, "tablet">;
export type RuntimeMode = "idle" | "area" | "zone" | "subzone";

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
  activeElementId: string | null = null;
  generation = 0;
  paused = false;

  readonly hardware = createNodeHealth();
  readonly display = createNodeHealth();
  readonly activeTransactionIds = new Set<string>();
  private readonly pendingWaits = new Set<PendingWait>();

  getNode(role: NodeRole): NodeHealth {
    return role === "hardware" ? this.hardware : this.display;
  }

  markConnected(role: NodeRole, now = Date.now()): void {
    const node = this.getNode(role);
    node.connected = true;
    node.ready = false;
    node.lastHeartbeatAt = now;
    node.uptimeMs = null;
    node.reportedStatus = null;
  }

  markReady(role: NodeRole): void {
    const node = this.getNode(role);
    if (node.connected) node.ready = true;
  }

  markUnavailable(role: NodeRole): void {
    this.getNode(role).ready = false;
  }

  markHeartbeat(
    role: NodeRole,
    uptimeMs: number,
    status: "ready" | "error",
    now = Date.now(),
  ): void {
    const node = this.getNode(role);
    node.lastHeartbeatAt = now;
    node.uptimeMs = uptimeMs;
    node.reportedStatus = status;
  }

  markDisconnected(role: NodeRole): void {
    Object.assign(this.getNode(role), createNodeHealth());
  }

  isOnline(role: NodeRole): boolean {
    const node = this.getNode(role);
    return node.connected && node.ready && node.reportedStatus !== "error";
  }

  isHeartbeatExpired(
    role: NodeRole,
    now: number,
    timeoutMs: number,
  ): boolean {
    const node = this.getNode(role);
    return (
      node.connected &&
      node.lastHeartbeatAt !== null &&
      now - node.lastHeartbeatAt >= timeoutMs
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
