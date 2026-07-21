import { ZodError } from "zod";
import type { AppSocket, ClientRegistry } from "../lib/client-registry.ts";
import { AreaSequenceController } from "./area-sequence-controller.ts";
import type { RuntimeController } from "./runtime-controller.ts";
import {
  ClientDisconnectedError,
  createTransactionId,
  TransactionTimeoutError,
} from "../lib/transactions.ts";
import type {
  AppConfig,
  Area,
  CommandError,
  CommandErrorCode,
  CommandResult,
  SocketAck,
  SubZoneControlRequest,
  SubZoneHardwareState,
  Zone,
} from "../utils/types.ts";
import {
  parseSubZoneControlRequest,
  parseZoneActivationRequest,
} from "../utils/validation.ts";

export interface ControlControllerOptions {
  emergencyBroadcastCount?: number;
  emergencyBroadcastIntervalMs?: number;
}

export class ControlController {
  private readonly emergencyBroadcastCount: number;
  private readonly emergencyBroadcastIntervalMs: number;
  private readonly areaSequence: AreaSequenceController;
  private emergencyUntil = 0;

  constructor(
    private readonly registry: ClientRegistry,
    private readonly runtime: RuntimeController,
    private readonly appConfig: AppConfig,
    options: ControlControllerOptions = {},
  ) {
    this.emergencyBroadcastCount = options.emergencyBroadcastCount ?? 5;
    this.emergencyBroadcastIntervalMs =
      options.emergencyBroadcastIntervalMs ?? 50;
    this.areaSequence = new AreaSequenceController(runtime, appConfig);
  }

  registerTablet(socket: AppSocket): void {
    socket.on("zone-activation", (payload, ack) => {
      void this.handleZoneActivation(payload, ack);
    });
    socket.on("subzone-control", (payload, ack) => {
      void this.handleSubZoneControl(payload, ack);
    });
    socket.on("sequence-stop", (ack) => {
      void this.handleSequenceStop(ack);
    });
    socket.on("sequence-pause", (ack) => {
      void this.handleSequencePause(ack);
    });
    socket.on("sequence-resume", (ack) => {
      void this.handleSequenceResume(ack);
    });
    socket.on("global-emergency-stop", () => {
      this.handleEmergencyStop();
    });
    socket.on("area-activation", (payload, ack) => {
      void this.handleAreaActivation(payload, ack);
    });
  }

  private async handleAreaActivation(
    payload: unknown,
    ack: SocketAck<CommandResult>,
  ): Promise<void> {
    const operationId = createTransactionId("area");
    const reply = this.once(ack);

    try {
      this.assertControlsAvailable();
      await this.areaSequence.start(payload);
      this.runtime.broadcastRuntimeStatus();
      reply({ status: "success", transaction_id: operationId });
    } catch (error) {
      reply(this.toCommandError(operationId, error));
    }
  }

  private async handleZoneActivation(
    payload: unknown,
    ack: SocketAck<CommandResult>,
  ): Promise<void> {
    const operationId = createTransactionId("zone");
    const reply = this.once(ack);

    try {
      this.assertControlsAvailable();
      const request = parseZoneActivationRequest(payload, this.appConfig);
      const { area, zone } = this.findZone(request.zone_id);
      const lights: SubZoneHardwareState[] = zone.subZones.map((subZone) => ({
        ...subZone,
        action: "activate",
      }));

      await this.activate(
        operationId,
        area,
        zone,
        lights,
        "zone",
      );
      this.runtime.broadcastRuntimeStatus();
      reply({ status: "success", transaction_id: operationId });
    } catch (error) {
      reply(this.toCommandError(operationId, error));
    }
  }

  private async handleSubZoneControl(
    payload: unknown,
    ack: SocketAck<CommandResult>,
  ): Promise<void> {
    const operationId = createTransactionId("subzone");
    const reply = this.once(ack);

    try {
      this.assertControlsAvailable();
      const request = parseSubZoneControlRequest(payload, this.appConfig);
      const { area, zone } = this.findZone(request.zone_id);

      await this.activate(
        operationId,
        area,
        zone,
        [this.toHardwareState(request)],
        "subzone",
      );
      this.runtime.broadcastRuntimeStatus();
      reply({ status: "success", transaction_id: operationId });
    } catch (error) {
      reply(this.toCommandError(operationId, error));
    }
  }

  private async activate(
    operationId: string,
    area: Area,
    zone: Zone,
    lights: SubZoneHardwareState[],
    mode: "zone" | "subzone",
  ): Promise<void> {
    this.runtime.requireSystemOnline();
    const generation = this.runtime.state.invalidate();
    this.runtime.state.mode = mode;
    this.runtime.state.activeAreaId = area.id;
    this.runtime.state.activeZoneId = zone.id;
    this.runtime.state.activeElementId =
      mode === "subzone" ? (lights[0]?.element_id ?? null) : null;

    try {
      await this.runtime.prepareZoneVideo(zone);
      this.assertCurrent(generation);

      const executeAtMs = this.runtime.nextExecutionTime();
      await Promise.all([
        this.runtime.applyHardwareState({
          area_id: area.id,
          zone_id: zone.id,
          scope: mode,
          mode: "replace",
          execute_at_ms: executeAtMs,
          lights,
        }),
        this.runtime.playZoneVideo(zone, executeAtMs),
      ]);
      this.assertCurrent(generation);
    } catch (error) {
      if (this.runtime.state.isCurrent(generation)) {
        await this.runtime.enterSystemFailSafe(
          `${mode} operation ${operationId} failed`,
        );
      }
      throw error;
    }
  }

  private async handleSequenceStop(
    ack: SocketAck<CommandResult>,
  ): Promise<void> {
    const operationId = createTransactionId("stop");
    const reply = this.once(ack);

    try {
      await this.runtime.stopNormally();
      reply({ status: "success", transaction_id: operationId });
    } catch (error) {
      await this.runtime.enterSystemFailSafe("normal stop failed");
      reply(this.toCommandError(operationId, error));
    }
  }

  private async handleSequencePause(
    ack: SocketAck<CommandResult>,
  ): Promise<void> {
    const operationId = createTransactionId("pause");
    const reply = this.once(ack);

    try {
      await this.runtime.pauseNormally();
      reply({ status: "success", transaction_id: operationId });
    } catch (error) {
      reply(this.toCommandError(operationId, error));
    }
  }

  private async handleSequenceResume(
    ack: SocketAck<CommandResult>,
  ): Promise<void> {
    const operationId = createTransactionId("resume");
    const reply = this.once(ack);

    try {
      await this.runtime.resumeNormally();
      reply({ status: "success", transaction_id: operationId });
    } catch (error) {
      reply(this.toCommandError(operationId, error));
    }
  }

  private handleEmergencyStop(): void {
    this.runtime.state.invalidate();
    this.emergencyUntil =
      Date.now() +
      this.emergencyBroadcastCount * this.emergencyBroadcastIntervalMs;

    const hardware = this.registry.getHardware();
    for (let index = 0; index < this.emergencyBroadcastCount; index += 1) {
      setTimeout(() => {
        if (hardware?.connected) {
          hardware.emit("hardware-emergency-shutdown", {
            signal: "emergency-halt",
          });
        }
      }, index * this.emergencyBroadcastIntervalMs);
    }

    void this.runtime.enterSystemFailSafe("global emergency stop");
  }

  private assertControlsAvailable(): void {
    if (Date.now() < this.emergencyUntil) {
      throw new Error("Emergency shutdown is still active");
    }
  }

  private assertCurrent(generation: number): void {
    if (!this.runtime.state.isCurrent(generation)) {
      throw new Error("Operation was superseded by a newer command");
    }
  }

  private findZone(zoneId: string): { area: Area; zone: Zone } {
    for (const area of this.appConfig.areas) {
      const zone = area.zones.find(({ id }) => id === zoneId);
      if (zone) return { area, zone };
    }

    throw new Error(`Unknown Zone: ${zoneId}`);
  }

  private toHardwareState(
    request: SubZoneControlRequest,
  ): SubZoneHardwareState {
    return {
      element_id: request.element_id,
      action: request.action,
      color_hex: request.color_hex,
      intensity_percent: request.intensity_percent,
      animation_duration_ms: request.animation_duration_ms,
    };
  }

  private once(
    ack: SocketAck<CommandResult>,
  ): (result: CommandResult) => void {
    let called = false;

    return (result) => {
      if (called) return;
      called = true;
      ack(result);
    };
  }

  private toCommandError(
    transactionId: string,
    error: unknown,
  ): CommandError {
    const message = error instanceof Error ? error.message : String(error);
    const normalizedMessage = message.toLowerCase();
    let errorCode: CommandErrorCode = "busy";

    if (error instanceof ZodError) {
      errorCode = "invalid_payload";
    } else if (error instanceof TransactionTimeoutError) {
      errorCode = "timeout";
    } else if (error instanceof ClientDisconnectedError) {
      errorCode =
        normalizedMessage.includes("display") ||
        normalizedMessage.includes("video")
        ? "display_offline"
        : "hardware_offline";
    } else if (message === "hardware_offline") {
      errorCode = "hardware_offline";
    } else if (message === "display_offline") {
      errorCode = "display_offline";
    } else if (
      normalizedMessage.includes("display") ||
      normalizedMessage.includes("video")
    ) {
      errorCode = "display_error";
    } else if (normalizedMessage.includes("hardware")) {
      errorCode = "hardware_error";
    }

    return {
      status: "error",
      transaction_id: transactionId,
      error_code: errorCode,
      message,
    };
  }
}
