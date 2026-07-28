import {
  HARDWARE_CLIENT_CLUBHOUSE,
  HARDWARE_CLIENT_MAIN_MODEL,
  LIGHTING_MODEL_TO_HARDWARE_CLIENT,
} from "./client-registry.ts";
import type { SubZoneHardwareState } from "../utils/types.ts";

export const HARDWARE_CLIENT_IDS = [
  HARDWARE_CLIENT_MAIN_MODEL,
  HARDWARE_CLIENT_CLUBHOUSE,
] as const;

export type HardwareEmptyPolicy = "send-empty" | "omit";

/**
 * Split hardware lights by SubZone.model → Pi client id.
 * main-model → raspberry-pi-1, clubhouse-model → raspberry-pi-2.
 */
export function partitionLightsByHardwareClient(
  lights: SubZoneHardwareState[],
): Record<string, SubZoneHardwareState[]> {
  const partitions: Record<string, SubZoneHardwareState[]> = {
    [HARDWARE_CLIENT_MAIN_MODEL]: [],
    [HARDWARE_CLIENT_CLUBHOUSE]: [],
  };

  for (const light of lights) {
    const clientId = LIGHTING_MODEL_TO_HARDWARE_CLIENT[light.model];
    partitions[clientId]!.push(light);
  }

  return partitions;
}

export function hardwareClientsForLights(
  lights: SubZoneHardwareState[],
  emptyPolicy: HardwareEmptyPolicy,
): string[] {
  const partitions = partitionLightsByHardwareClient(lights);

  if (emptyPolicy === "send-empty") {
    return [...HARDWARE_CLIENT_IDS];
  }

  return HARDWARE_CLIENT_IDS.filter(
    (clientId) => (partitions[clientId] ?? []).length > 0,
  );
}
