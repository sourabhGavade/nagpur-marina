import type { RuntimeController } from "./runtime-controller.ts";
import type {
  AppConfig,
  Area,
  SubZoneHardwareState,
  Zone,
} from "../utils/types.ts";
import { parseAreaActivationRequest } from "../utils/validation.ts";

export interface SequenceItem {
  area: Area;
  zone: Zone;
}

export function buildAreaSequence(
  appConfig: AppConfig,
  startingAreaId: number,
): SequenceItem[] {
  const area = appConfig.areas.find(({ id }) => id === startingAreaId);

  if (!area) {
    throw new Error(`Unknown Area: ${startingAreaId}`);
  }

  return [...area.zones]
    .sort((left, right) => left.sequence_order - right.sequence_order)
    .map((zone) => ({ area, zone }));
}

export function getTransitionOffset(zone: Zone): number {
  return zone.video_duration_ms - zone.video_crossfade_duration_ms;
}

export class AreaSequenceController {
  constructor(
    private readonly runtime: RuntimeController,
    private readonly appConfig: AppConfig,
  ) {}

  async start(payload: unknown): Promise<void> {
    const request = parseAreaActivationRequest(payload, this.appConfig);
    this.runtime.requireSystemOnline();

    const sequence = buildAreaSequence(this.appConfig, request.area_id);
    if (sequence.length === 0) {
      throw new Error("The selected Area sequence has no Zones");
    }

    const generation = this.runtime.state.invalidate();
    this.runtime.state.mode = "area";

    try {
      const first = sequence[0]!;
      this.setActive(first);
      await this.runtime.prepareZoneVideo(first.zone);
      this.assertCurrent(generation);

      const executeAtMs = this.runtime.nextExecutionTime();
      await this.dispatch(first, executeAtMs);
      this.assertCurrent(generation);
      this.runtime.broadcastRuntimeStatus();

      void this.continueLoop(
        sequence,
        0,
        executeAtMs,
        generation,
      ).catch(async (error) => {
        if (!this.runtime.state.isCurrent(generation)) return;
        console.error(
          `[sequence] Area loop failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        await this.runtime.enterSystemFailSafe("Area sequence failed");
      });
    } catch (error) {
      if (this.runtime.state.isCurrent(generation)) {
        await this.runtime.enterSystemFailSafe(
          "Initial Area Zone failed",
        );
      }
      throw error;
    }
  }

  private async continueLoop(
    sequence: SequenceItem[],
    currentIndex: number,
    currentStartedAtMs: number,
    generation: number,
  ): Promise<void> {
    while (this.runtime.state.isCurrent(generation)) {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= sequence.length) {
        await this.finishSequence(
          sequence[currentIndex]!,
          currentStartedAtMs,
          generation,
        );
        return;
      }

      const current = sequence[currentIndex]!;
      const next = sequence[nextIndex]!;

      await this.runtime.prepareZoneVideo(next.zone);
      this.assertCurrent(generation);

      const requestedExecutionTime =
        currentStartedAtMs + getTransitionOffset(current.zone);
      const shouldContinue = await this.runtime.state.waitFor(
        this.runtime.timeUntilDispatch(requestedExecutionTime),
        generation,
      );
      if (!shouldContinue) return;

      const executeAtMs = this.runtime.ensureFutureExecutionTime(
        requestedExecutionTime,
      );
      await this.dispatch(next, executeAtMs);
      this.assertCurrent(generation);
      this.setActive(next);
      this.runtime.broadcastRuntimeStatus();

      currentIndex = nextIndex;
      currentStartedAtMs = executeAtMs;
    }
  }

  private async finishSequence(
    last: SequenceItem,
    startedAtMs: number,
    generation: number,
  ): Promise<void> {
    const endsAtMs = startedAtMs + last.zone.video_duration_ms;
    const shouldContinue = await this.runtime.state.waitFor(
      this.runtime.timeUntilDispatch(endsAtMs),
      generation,
    );
    if (!shouldContinue) return;

    this.assertCurrent(generation);
    await this.runtime.finishNormally();
  }

  private async dispatch(
    item: SequenceItem,
    executeAtMs: number,
  ): Promise<void> {
    const lights: SubZoneHardwareState[] = item.zone.subZones.map(
      (subZone) => ({
        ...subZone,
        action: "activate",
      }),
    );

    await Promise.all([
      this.runtime.applyHardwareState({
        area_id: item.area.id,
        zone_id: item.zone.id,
        lighting_id: null,
        scope: "area",
        mode: "replace",
        execute_at_ms: executeAtMs,
        lights,
      }),
      this.runtime.playZoneVideo(item.zone, executeAtMs),
    ]);
  }

  private setActive(item: SequenceItem): void {
    this.runtime.state.activeAreaId = item.area.id;
    this.runtime.state.activeZoneId = item.zone.id;
    this.runtime.state.activeLightingId = null;
    this.runtime.state.activeElementId = null;
  }

  private assertCurrent(generation: number): void {
    if (!this.runtime.state.isCurrent(generation)) {
      throw new Error("Area sequence was superseded");
    }
  }
}
