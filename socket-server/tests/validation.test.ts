import { describe, expect, test } from "bun:test";
import { config } from "../utils/config.ts";
import {
  AppConfigSchema,
  parseAreaActivationRequest,
  parseLightingControlRequest,
  parseSubZoneControlRequest,
  parseZoneActivationRequest,
} from "../utils/validation.ts";

describe("configuration validation", () => {
  test("accepts the application configuration", () => {
    expect(AppConfigSchema.parse(config)).toEqual(config);
  });

  test("rejects an intensity outside 0–1", () => {
    const invalidConfig = structuredClone(config);
    invalidConfig.areas[0]!.zones[0]!.subZones[0]!.intensity = 80;

    expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("rejects a crossfade longer than its video", () => {
    const invalidConfig = structuredClone(config);
    const zone = invalidConfig.areas[0]!.zones[0]!;
    zone.video_crossfade_duration_ms = zone.video_duration_ms + 1;

    expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("rejects duplicate element IDs", () => {
    const invalidConfig = structuredClone(config);
    const [first, second] = invalidConfig.areas[0]!.zones[0]!.subZones;
    second!.element_id = first!.element_id;

    expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("rejects duplicate Lighting ids", () => {
    const invalidConfig = structuredClone(config);
    invalidConfig.lightings[1]!.id = invalidConfig.lightings[0]!.id;

    expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
  });
});

describe("Tablet request validation", () => {
  test("accepts known Area and Zone IDs", () => {
    expect(parseAreaActivationRequest({ area_id: 1 }, config)).toEqual({
      area_id: 1,
    });
    expect(
      parseZoneActivationRequest({ zone_id: "foyer-welcome" }, config),
    ).toEqual({ zone_id: "foyer-welcome" });
  });

  test("accepts known Lighting ids", () => {
    expect(
      parseLightingControlRequest(
        { lighting_id: "lighting-1", action: "activate" },
        config,
      ),
    ).toEqual({ lighting_id: "lighting-1", action: "activate" });
  });

  test("rejects unknown entities", () => {
    expect(() =>
      parseAreaActivationRequest({ area_id: 999 }, config),
    ).toThrow();
    expect(() =>
      parseZoneActivationRequest({ zone_id: "missing-zone" }, config),
    ).toThrow();
    expect(() =>
      parseLightingControlRequest(
        { lighting_id: "missing-lighting", action: "activate" },
        config,
      ),
    ).toThrow();
  });

  test("ensures a Sub-Zone belongs to its selected Zone", () => {
    expect(() =>
      parseSubZoneControlRequest(
        {
          zone_id: "foyer-welcome",
          element_id: "corridor_wall_left",
          action: "activate",
          intensity: 0.5,
          animation_duration_ms: 500,
        },
        config,
      ),
    ).toThrow();
  });
});
