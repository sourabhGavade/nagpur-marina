import type { ClientRegistry, AppIo, AppSocket } from "../lib/client-registry.ts";
import { RuntimeState, type NodeRole } from "../lib/runtime-state.ts";
import { createTransactionId, requestAck } from "../lib/transactions.ts";
import type {
  DisplayPlaybackResult,
  HardwareApplyStatePayload,
  HardwareApplyResult,
  PauseVideoResult,
  PrepareVideoResult,
  ReadinessResult,
  ResumeVideoResult,
  RuntimeStatus,
  SocketAck,
  StopVideoResult,
  Zone,
} from "../utils/types.ts";
import {
  DisplayPlaybackResultSchema,
  HardwareApplyResultSchema,
  PauseVideoResultSchema,
  PrepareVideoResultSchema,
  ReadinessResultSchema,
  ResumeVideoResultSchema,
  StopVideoResultSchema,
} from "../utils/validation.ts";

const TABLET_ROOM = "role:tablet";

export interface RuntimeControllerOptions {
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  readinessTimeoutMs?: number;
  safeCommandTimeoutMs?: number;
  safeExecutionLeadMs?: number;
  mediaCommandTimeoutMs?: number;
  executionLeadMs?: number;
}

export class RuntimeController {
  readonly state = new RuntimeState();

  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly readinessTimeoutMs: number;
  private readonly safeCommandTimeoutMs: number;
  private readonly safeExecutionLeadMs: number;
  private readonly mediaCommandTimeoutMs: number;
  private readonly executionLeadMs: number;
  private readonly readinessInFlight = new Set<NodeRole>();
  private readonly failuresInFlight = new Set<NodeRole>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly io: AppIo,
    private readonly registry: ClientRegistry,
    options: RuntimeControllerOptions = {},
  ) {
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5_000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 30_000;
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 3_000;
    this.safeCommandTimeoutMs = options.safeCommandTimeoutMs ?? 2_000;
    this.safeExecutionLeadMs = options.safeExecutionLeadMs ?? 100;
    this.mediaCommandTimeoutMs = options.mediaCommandTimeoutMs ?? 5_000;
    this.executionLeadMs = options.executionLeadMs ?? 250;
  }

  start(): void {
    if (this.heartbeatTimer) return;

    this.running = true;
    this.heartbeatTimer = setInterval(
      () => this.runHeartbeatCycle(),
      this.heartbeatIntervalMs,
    );
  }

  stop(): void {
    this.running = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.state.invalidate();
  }

  onNodeConnected(role: NodeRole, socket: AppSocket): void {
    this.state.markConnected(role);
    this.broadcastStatus(role);
    void this.verifyReadiness(role, socket);
  }

  onNodeDisconnected(role: NodeRole): void {
    const wasConnected = this.state.getNode(role).connected;
    this.state.markDisconnected(role);
    this.broadcastStatus(role);

    if (this.running && wasConnected && !this.failuresInFlight.has(role)) {
      void this.enterFailSafe(role, `${role} disconnected`);
    }
  }

  onHeartbeat(
    role: NodeRole,
    heartbeat: { uptime_ms: number; status: "ready" | "error" },
    socket: AppSocket,
  ): void {
    this.state.markHeartbeat(role, heartbeat.uptime_ms, heartbeat.status);

    if (heartbeat.status === "error") {
      void this.failNode(role, socket, `${role} reported an error`);
    } else if (!this.state.getNode(role).ready) {
      void this.verifyReadiness(role, socket);
    }
  }

  requireSystemOnline(): void {
    if (!this.state.isOnline("hardware")) {
      throw new Error("hardware_offline");
    }
    if (!this.state.isOnline("display")) {
      throw new Error("display_offline");
    }
  }

  nextExecutionTime(): number {
    return Date.now() + this.executionLeadMs;
  }

  timeUntilDispatch(executeAtMs: number): number {
    return Math.max(0, executeAtMs - Date.now() - this.executionLeadMs);
  }

  ensureFutureExecutionTime(executeAtMs: number): number {
    return Math.max(executeAtMs, this.nextExecutionTime());
  }

  async prepareZoneVideo(zone: Zone): Promise<void> {
    const socket = this.registry.getDisplay();
    if (!socket?.connected || !this.state.isOnline("display")) {
      throw new Error("display_offline");
    }

    const transactionId = createTransactionId("prepare-video");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: this.mediaCommandTimeoutMs,
      schema: PrepareVideoResultSchema,
      emit: (ack) => {
        socket.emit(
          "prepare-video",
          {
            transaction_id: transactionId,
            zone_id: zone.id,
            video_url: zone.video_url,
          },
          ack as SocketAck<PrepareVideoResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Display prepare ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  async applyHardwareState(
    payload: Omit<HardwareApplyStatePayload, "transaction_id">,
  ): Promise<void> {
    const socket = this.registry.getHardware();
    if (!socket?.connected || !this.state.isOnline("hardware")) {
      throw new Error("hardware_offline");
    }

    const transactionId = createTransactionId("apply-state");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: Math.max(
        1_000,
        payload.execute_at_ms - Date.now() + 1_000,
      ),
      schema: HardwareApplyResultSchema,
      emit: (ack) => {
        socket.emit(
          "hardware-apply-state",
          { transaction_id: transactionId, ...payload },
          ack as SocketAck<HardwareApplyResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Hardware ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  async playZoneVideo(zone: Zone, executeAtMs: number): Promise<void> {
    const socket = this.registry.getDisplay();
    if (!socket?.connected || !this.state.isOnline("display")) {
      throw new Error("display_offline");
    }

    const transactionId = createTransactionId("play-video");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: Math.max(1_000, executeAtMs - Date.now() + 1_000),
      schema: DisplayPlaybackResultSchema,
      emit: (ack) => {
        socket.emit(
          "play-video-transition",
          {
            transaction_id: transactionId,
            zone_id: zone.id,
            execute_at_ms: executeAtMs,
            video_duration_ms: zone.video_duration_ms,
            video_crossfade_duration_ms:
              zone.video_crossfade_duration_ms,
            loop: this.state.mode !== "area",
          },
          ack as SocketAck<DisplayPlaybackResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Display playback ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  async pauseNormally(): Promise<void> {
    this.requireSystemOnline();
    const display = this.registry.getDisplay();
    if (!display?.connected) throw new Error("display_offline");
    if (!this.state.pause()) {
      throw new Error(
        this.state.paused ? "Sequence is already paused" : "No active sequence",
      );
    }

    try {
      await this.pauseDisplay(display);
      this.broadcastRuntimeStatus();
    } catch (error) {
      this.state.resume();
      throw error;
    }
  }

  async resumeNormally(): Promise<void> {
    this.requireSystemOnline();
    const display = this.registry.getDisplay();
    if (!display?.connected) throw new Error("display_offline");
    if (!this.state.paused) throw new Error("Sequence is not paused");

    await this.resumeDisplay(display);
    this.state.resume();
    this.broadcastRuntimeStatus();
  }

  async stopNormally(): Promise<void> {
    const hardware = this.registry.getHardware();
    const display = this.registry.getDisplay();
    this.state.invalidate();

    const failures: unknown[] = [];
    const tasks: Promise<unknown>[] = [];

    if (hardware?.connected) tasks.push(this.sendAllOff(hardware));
    else failures.push(new Error("hardware_offline"));

    if (display?.connected) tasks.push(this.stopDisplay(display));
    else failures.push(new Error("display_offline"));

    const results = await Promise.allSettled(tasks);
    failures.push(
      ...results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        )
        .map(({ reason }) => reason),
    );

    if (failures.length > 0) {
      throw new AggregateError(failures, "Normal stop did not fully complete");
    }
    this.broadcastRuntimeStatus();
  }

  getRuntimeStatus(): RuntimeStatus {
    return {
      mode: this.state.mode,
      playback_state:
        this.state.mode === "idle"
          ? "idle"
          : this.state.paused
            ? "paused"
            : "playing",
      active_area_id: this.state.activeAreaId,
      active_zone_id: this.state.activeZoneId,
      active_element_id: this.state.activeElementId,
    };
  }

  broadcastRuntimeStatus(): void {
    this.io
      .to(TABLET_ROOM)
      .emit("runtime-status", this.getRuntimeStatus());
  }

  async enterSystemFailSafe(reason: string): Promise<void> {
    await this.enterFailSafe(null, reason);
  }

  private async verifyReadiness(
    role: NodeRole,
    socket: AppSocket,
  ): Promise<void> {
    if (this.readinessInFlight.has(role) || !socket.connected) return;
    this.readinessInFlight.add(role);

    const transactionId = createTransactionId(`${role}-ready`);
    const payload = {
      transaction_id: transactionId,
      requested_at_ms: Date.now(),
    };

    try {
      const result = await requestAck({
        socket,
        runtime: this.state,
        transactionId,
        timeoutMs: this.readinessTimeoutMs,
        schema: ReadinessResultSchema,
        emit: (ack) => {
          const typedAck = ack as SocketAck<ReadinessResult>;
          socket.emit(
            role === "hardware"
              ? "hardware-readiness-check"
              : "display-readiness-check",
            payload,
            typedAck,
          );
        },
      });

      if (result.transaction_id !== transactionId) {
        throw new Error("Readiness ACK transaction_id does not match");
      }
      if (result.status === "error") {
        throw new Error(`${result.error_code}: ${result.message}`);
      }
      if (!socket.connected) return;

      this.state.markReady(role);
      this.broadcastStatus(role);
    } catch (error) {
      if (
        !this.running ||
        !socket.connected ||
        !this.state.getNode(role).connected
      ) {
        return;
      }
      console.error(
        `[runtime] ${role} readiness failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.failNode(role, socket, `${role} readiness failed`);
    } finally {
      this.readinessInFlight.delete(role);
    }
  }

  private runHeartbeatCycle(): void {
    const heartbeat = { sent_at_ms: Date.now() };
    const hardware = this.registry.getHardware();
    const display = this.registry.getDisplay();

    if (hardware?.connected) hardware.emit("server-heartbeat", heartbeat);
    if (display?.connected) display.emit("server-heartbeat", heartbeat);

    const now = Date.now();
    if (
      hardware?.connected &&
      this.state.isHeartbeatExpired("hardware", now, this.heartbeatTimeoutMs)
    ) {
      void this.failNode("hardware", hardware, "hardware heartbeat timed out");
    }
    if (
      display?.connected &&
      this.state.isHeartbeatExpired("display", now, this.heartbeatTimeoutMs)
    ) {
      void this.failNode("display", display, "display heartbeat timed out");
    }
  }

  private async failNode(
    role: NodeRole,
    socket: AppSocket,
    reason: string,
  ): Promise<void> {
    if (!this.running) return;
    if (this.failuresInFlight.has(role)) return;
    this.failuresInFlight.add(role);
    this.state.markUnavailable(role);
    this.broadcastStatus(role);

    try {
      await this.enterFailSafe(role, reason);
    } finally {
      if (socket.connected) socket.disconnect(true);
      this.failuresInFlight.delete(role);
    }
  }

  private async enterFailSafe(
    failedRole: NodeRole | null,
    reason: string,
  ): Promise<void> {
    console.error(`[runtime] entering safe idle: ${reason}`);
    this.state.invalidate();
    this.broadcastRuntimeStatus();

    const tasks: Promise<unknown>[] = [];
    const hardware = this.registry.getHardware();
    const display = this.registry.getDisplay();

    if (failedRole !== "hardware" && hardware?.connected) {
      tasks.push(this.sendAllOff(hardware));
    }
    if (failedRole !== "display" && display?.connected) {
      tasks.push(this.stopDisplay(display));
    }

    const results = await Promise.allSettled(tasks);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `[runtime] fail-safe command failed: ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`,
        );
      }
    }
  }

  private async sendAllOff(socket: AppSocket): Promise<void> {
    const transactionId = createTransactionId("safe-off");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: this.safeCommandTimeoutMs,
      schema: HardwareApplyResultSchema,
      emit: (ack) => {
        socket.emit(
          "hardware-apply-state",
          {
            transaction_id: transactionId,
            area_id: null,
            zone_id: null,
            scope: "system",
            mode: "replace",
            execute_at_ms: Date.now() + this.safeExecutionLeadMs,
            lights: [],
          },
          ack as SocketAck<HardwareApplyResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Hardware ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  private async stopDisplay(socket: AppSocket): Promise<void> {
    const transactionId = createTransactionId("safe-stop-video");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: this.safeCommandTimeoutMs,
      schema: StopVideoResultSchema,
      emit: (ack) => {
        socket.emit(
          "stop-video",
          { transaction_id: transactionId },
          ack as SocketAck<StopVideoResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Display ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  private async pauseDisplay(socket: AppSocket): Promise<void> {
    const transactionId = createTransactionId("pause-video");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: this.safeCommandTimeoutMs,
      schema: PauseVideoResultSchema,
      emit: (ack) => {
        socket.emit(
          "pause-video",
          { transaction_id: transactionId },
          ack as SocketAck<PauseVideoResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Display pause ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  private async resumeDisplay(socket: AppSocket): Promise<void> {
    const transactionId = createTransactionId("resume-video");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: this.safeCommandTimeoutMs,
      schema: ResumeVideoResultSchema,
      emit: (ack) => {
        socket.emit(
          "resume-video",
          { transaction_id: transactionId },
          ack as SocketAck<ResumeVideoResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Display resume ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  private broadcastStatus(role: NodeRole): void {
    this.io
      .to(TABLET_ROOM)
      .emit(role === "hardware" ? "hardware-status" : "display-status", {
        online: this.state.isOnline(role),
      });
  }
}
