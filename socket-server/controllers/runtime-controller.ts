import {
  type ClientRegistry,
  type AppIo,
  type AppSocket,
} from "../lib/client-registry.ts";
import {
  EXPECTED_HARDWARE_CLIENTS,
  IDLE_HOLD_LAST_FRAME_MS,
  IDLE_LIGHTS_CONFIG,
} from "../lib/consts.ts";
import {
  hardwareClientsForLights,
  partitionLightsByHardwareClient,
  type HardwareEmptyPolicy,
} from "../lib/hardware-routing.ts";
import { RuntimeState, type NodeRole } from "../lib/runtime-state.ts";
import { createTransactionId, requestAck } from "../lib/transactions.ts";
import type {
  DisplayPlaybackResult,
  HardwareApplyStatePayload,
  HardwareApplyResult,
  MuteVideoResult,
  PauseVideoResult,
  PrepareVideoResult,
  ReadinessResult,
  ResumeVideoResult,
  RuntimeStatus,
  SocketAck,
  StopVideoResult,
  SubZoneHardwareState,
  UnmuteVideoResult,
  Zone,
} from "../utils/types.ts";
import {
  DisplayPlaybackResultSchema,
  HardwareApplyResultSchema,
  MuteVideoResultSchema,
  PauseVideoResultSchema,
  PrepareVideoResultSchema,
  ReadinessResultSchema,
  ResumeVideoResultSchema,
  StopVideoResultSchema,
  UnmuteVideoResultSchema,
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
  idleHoldLastFrameMs?: number;
}

type FlightKey = string;

function hardwareFlightKey(clientId: string): FlightKey {
  return `hardware:${clientId}`;
}

function displayFlightKey(): FlightKey {
  return "display";
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
  private readonly idleHoldLastFrameMs: number;
  private readonly readinessInFlight = new Set<FlightKey>();
  private readonly failuresInFlight = new Set<FlightKey>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private muted = false;

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
    this.idleHoldLastFrameMs =
      options.idleHoldLastFrameMs ?? IDLE_HOLD_LAST_FRAME_MS;
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
    if (role === "hardware") {
      this.state.markHardwareConnected(socket.data.client_id);
    } else {
      this.state.markDisplayConnected();
    }
    this.broadcastStatus(role);
    void this.verifyReadiness(role, socket);
  }

  onNodeDisconnected(role: NodeRole, clientId: string): void {
    const flightKey =
      role === "hardware" ? hardwareFlightKey(clientId) : displayFlightKey();

    const wasConnected =
      role === "hardware"
        ? (this.state.getHardwareNode(clientId)?.connected ?? false)
        : this.state.getDisplayNode().connected;

    if (role === "hardware") {
      this.state.markHardwareDisconnected(clientId);
    } else {
      this.state.markDisplayDisconnected();
    }
    this.broadcastStatus(role);

    if (this.running && wasConnected && !this.failuresInFlight.has(flightKey)) {
      void this.enterFailSafe(role, null, `${role} disconnected`);
    }
  }

  /** Last tablet left — clear lights and stop display like other fail-safes. */
  onTabletDisconnected(): void {
    if (!this.running || this.registry.tabletCount > 0) return;
    void this.enterFailSafe(null, null, "tablet disconnected");
  }

  onHeartbeat(
    role: NodeRole,
    heartbeat: { uptime_ms: number; status: "ready" | "error" },
    socket: AppSocket,
  ): void {
    console.info(
      `[heartbeat] received role=${role} client=${socket.data.client_id} uptime_ms=${heartbeat.uptime_ms} status=${heartbeat.status}`,
    );

    if (role === "hardware") {
      this.state.markHardwareHeartbeat(
        socket.data.client_id,
        heartbeat.uptime_ms,
        heartbeat.status,
      );
    } else {
      this.state.markDisplayHeartbeat(heartbeat.uptime_ms, heartbeat.status);
    }

    const ready =
      role === "hardware"
        ? (this.state.getHardwareNode(socket.data.client_id)?.ready ?? false)
        : this.state.getDisplayNode().ready;

    if (heartbeat.status === "error") {
      void this.failNode(role, socket, `${role} reported an error`);
    } else if (!ready) {
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

  /**
   * Split lights by SubZone.model and apply to each Pi.
   * - send-empty (default): always both Pis; empty list clears that Pi.
   * - omit: only Pis that have lights in this command.
   */
  async applyHardwareState(
    payload: Omit<HardwareApplyStatePayload, "transaction_id">,
    options: { emptyPolicy?: HardwareEmptyPolicy } = {},
  ): Promise<void> {
    const emptyPolicy = options.emptyPolicy ?? "send-empty";

    if (!this.state.isOnline("hardware")) {
      throw new Error("hardware_offline");
    }

    if (
      emptyPolicy === "send-empty" &&
      this.registry.getHardwareClients().length !== EXPECTED_HARDWARE_CLIENTS
    ) {
      throw new Error("hardware_offline");
    }

    const partitions = partitionLightsByHardwareClient(payload.lights);
    const clientIds = hardwareClientsForLights(payload.lights, emptyPolicy);

    if (clientIds.length === 0) {
      throw new Error("hardware_offline");
    }

    for (const clientId of clientIds) {
      if (!this.registry.getHardwareClient(clientId)) {
        throw new Error("hardware_offline");
      }
    }

    const transactionId = createTransactionId("apply-state");
    const timeoutMs = Math.max(
      1_000,
      payload.execute_at_ms - Date.now() + 1_000,
    );

    const results = await Promise.all(
      clientIds.map((clientId) => {
        const socket = this.registry.getHardwareClient(clientId)!;
        const fullPayload = {
          transaction_id: transactionId,
          ...payload,
          lights: partitions[clientId] ?? [],
        };

        return requestAck({
          socket,
          runtime: this.state,
          transactionId,
          timeoutMs,
          schema: HardwareApplyResultSchema,
          emit: (ack) => {
            socket.emit(
              "hardware-apply-state",
              fullPayload,
              ack as SocketAck<HardwareApplyResult>,
            );
          },
        });
      }),
    );

    for (const result of results) {
      if (result.transaction_id !== transactionId) {
        throw new Error("Hardware ACK transaction_id does not match");
      }
      if (result.status === "error") {
        throw new Error(`${result.error_code}: ${result.message}`);
      }
    }
  }

  async applyHardwareStateToClient(
    clientId: string,
    payload: Omit<HardwareApplyStatePayload, "transaction_id">,
  ): Promise<void> {
    if (!this.state.isOnline("hardware")) {
      throw new Error("hardware_offline");
    }

    const socket = this.registry.getHardwareClient(clientId);
    if (!socket) {
      throw new Error("hardware_offline");
    }

    const transactionId = createTransactionId("apply-state");
    const timeoutMs = Math.max(
      1_000,
      payload.execute_at_ms - Date.now() + 1_000,
    );
    const fullPayload = { transaction_id: transactionId, ...payload };

    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs,
      schema: HardwareApplyResultSchema,
      emit: (ack) => {
        socket.emit(
          "hardware-apply-state",
          fullPayload,
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
            video_crossfade_duration_ms: zone.video_crossfade_duration_ms,
            loop: this.state.mode === "subzone",
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

  async muteNormally(): Promise<void> {
    this.requireSystemOnline();
    const display = this.registry.getDisplay();
    if (!display?.connected) throw new Error("display_offline");

    await this.muteDisplay(display);
    this.muted = true;
    this.broadcastRuntimeStatus();
  }

  async unmuteNormally(): Promise<void> {
    this.requireSystemOnline();
    const display = this.registry.getDisplay();
    if (!display?.connected) throw new Error("display_offline");

    await this.unmuteDisplay(display);
    this.muted = false;
    this.broadcastRuntimeStatus();
  }

  async stopNormally(): Promise<void> {
    const hardwareClients = this.registry.getHardwareClients();
    const display = this.registry.getDisplay();
    this.state.invalidate();

    const failures: unknown[] = [];
    const tasks: Promise<unknown>[] = [];

    if (hardwareClients.length < EXPECTED_HARDWARE_CLIENTS) {
      failures.push(new Error("hardware_offline"));
    }
    for (const hardware of hardwareClients) {
      tasks.push(this.sendIdleState(hardware));
    }

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
    this.muted = false;
    this.broadcastRuntimeStatus();
  }

  /** Natural finish: preserve last area/zone; display holds last frame then idle. */
  async finishNormally(): Promise<void> {
    const display = this.registry.getDisplay();
    const generation = this.state.endPlayback();

    const failures: unknown[] = [];

    if (display?.connected) {
      try {
        await this.stopDisplay(display, {
          hold_last_frame_ms: this.idleHoldLastFrameMs,
        });
      } catch (error) {
        failures.push(error);
      }
    } else {
      failures.push(new Error("display_offline"));
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "Natural finish did not fully complete",
      );
    }

    this.broadcastRuntimeStatus();
    void this.applyIdleLightsAfterHold(generation);
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
      muted: this.muted,
      active_area_id: this.state.activeAreaId,
      active_zone_id: this.state.activeZoneId,
      active_lighting_id: this.state.activeLightingId,
      active_element_id: this.state.activeElementId,
    };
  }

  broadcastRuntimeStatus(): void {
    this.io.to(TABLET_ROOM).emit("runtime-status", this.getRuntimeStatus());
  }

  async enterSystemFailSafe(reason: string): Promise<void> {
    await this.enterFailSafe(null, null, reason);
  }

  private async verifyReadiness(
    role: NodeRole,
    socket: AppSocket,
  ): Promise<void> {
    const flightKey =
      role === "hardware"
        ? hardwareFlightKey(socket.data.client_id)
        : displayFlightKey();

    if (this.readinessInFlight.has(flightKey) || !socket.connected) return;
    this.readinessInFlight.add(flightKey);

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

      if (role === "hardware") {
        this.state.markHardwareReady(socket.data.client_id);
      } else {
        this.state.markDisplayReady();
      }
      this.broadcastStatus(role);
    } catch (error) {
      const stillConnected =
        role === "hardware"
          ? (this.state.getHardwareNode(socket.data.client_id)?.connected ??
            false)
          : this.state.getDisplayNode().connected;

      if (!this.running || !socket.connected || !stillConnected) {
        return;
      }
      console.error(
        `[runtime] ${role} readiness failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.failNode(role, socket, `${role} readiness failed`);
    } finally {
      this.readinessInFlight.delete(flightKey);
    }
  }

  private runHeartbeatCycle(): void {
    const heartbeat = { sent_at_ms: Date.now() };
    const hardwareClients = this.registry.getHardwareClients();
    const display = this.registry.getDisplay();

    for (const hardware of hardwareClients) {
      hardware.emit("server-heartbeat", heartbeat);
      console.info(
        `[heartbeat] sent role=hardware client=${hardware.data.client_id} sent_at_ms=${heartbeat.sent_at_ms}`,
      );
    }

    if (display?.connected) {
      display.emit("server-heartbeat", heartbeat);
      console.info(
        `[heartbeat] sent role=display client=${display.data.client_id} sent_at_ms=${heartbeat.sent_at_ms}`,
      );
    }

    const now = Date.now();
    for (const hardware of hardwareClients) {
      if (
        this.state.isHardwareHeartbeatExpired(
          hardware.data.client_id,
          now,
          this.heartbeatTimeoutMs,
        )
      ) {
        void this.failNode(
          "hardware",
          hardware,
          "hardware heartbeat timed out",
        );
      }
    }
    if (
      display?.connected &&
      this.state.isDisplayHeartbeatExpired(now, this.heartbeatTimeoutMs)
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

    const flightKey =
      role === "hardware"
        ? hardwareFlightKey(socket.data.client_id)
        : displayFlightKey();

    if (this.failuresInFlight.has(flightKey)) return;
    this.failuresInFlight.add(flightKey);

    if (role === "hardware") {
      this.state.markHardwareUnavailable(socket.data.client_id);
    } else {
      this.state.markDisplayUnavailable();
    }
    this.broadcastStatus(role);

    try {
      await this.enterFailSafe(role, socket, reason);
    } finally {
      if (socket.connected) socket.disconnect(true);
      this.failuresInFlight.delete(flightKey);
    }
  }

  private async enterFailSafe(
    failedRole: NodeRole | null,
    failedSocket: AppSocket | null,
    reason: string,
  ): Promise<void> {
    console.error(`[runtime] entering safe idle: ${reason}`);
    this.state.invalidate();
    this.broadcastRuntimeStatus();

    const tasks: Promise<unknown>[] = [];
    const hardwareClients = this.registry.getHardwareClients();
    const display = this.registry.getDisplay();

    for (const hardware of hardwareClients) {
      if (failedSocket && hardware.id === failedSocket.id) continue;
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

  private async applyIdleLightsAfterHold(generation: number): Promise<void> {
    const stillCurrent = await this.state.waitFor(
      this.idleHoldLastFrameMs,
      generation,
    );
    if (!stillCurrent || !this.running) return;

    const hardwareClients = this.registry.getHardwareClients();
    if (hardwareClients.length === 0) return;

    const results = await Promise.allSettled(
      hardwareClients.map((hardware) => this.sendIdleState(hardware)),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `[runtime] idle lights after hold failed: ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`,
        );
      }
    }
  }

  private idleLightsPayload(): SubZoneHardwareState[] {
    return IDLE_LIGHTS_CONFIG.map((light) => ({
      ...light,
      action: "activate",
    }));
  }

  /** Logo/stop and post-hold idle: mode idle with IDLE_LIGHTS_CONFIG. */
  private async sendIdleState(socket: AppSocket): Promise<void> {
    const transactionId = createTransactionId("safe-idle");
    const partitions = partitionLightsByHardwareClient(this.idleLightsPayload());
    const lights = partitions[socket.data.client_id] ?? [];

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
            lighting_id: null,
            scope: "system",
            mode: "idle",
            execute_at_ms: Date.now() + this.safeExecutionLeadMs,
            lights,
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
            lighting_id: null,
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

  private async stopDisplay(
    socket: AppSocket,
    options: { hold_last_frame_ms?: number } = {},
  ): Promise<void> {
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
          {
            transaction_id: transactionId,
            ...(options.hold_last_frame_ms !== undefined
              ? { hold_last_frame_ms: options.hold_last_frame_ms }
              : {}),
          },
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

  private async muteDisplay(socket: AppSocket): Promise<void> {
    const transactionId = createTransactionId("mute-video");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: this.safeCommandTimeoutMs,
      schema: MuteVideoResultSchema,
      emit: (ack) => {
        socket.emit(
          "mute-video",
          { transaction_id: transactionId },
          ack as SocketAck<MuteVideoResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Display mute ACK transaction_id does not match");
    }
    if (result.status === "error") {
      throw new Error(`${result.error_code}: ${result.message}`);
    }
  }

  private async unmuteDisplay(socket: AppSocket): Promise<void> {
    const transactionId = createTransactionId("unmute-video");
    const result = await requestAck({
      socket,
      runtime: this.state,
      transactionId,
      timeoutMs: this.safeCommandTimeoutMs,
      schema: UnmuteVideoResultSchema,
      emit: (ack) => {
        socket.emit(
          "unmute-video",
          { transaction_id: transactionId },
          ack as SocketAck<UnmuteVideoResult>,
        );
      },
    });

    if (result.transaction_id !== transactionId) {
      throw new Error("Display unmute ACK transaction_id does not match");
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
