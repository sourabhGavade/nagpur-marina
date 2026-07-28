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

  test("rejects duplicate model+element IDs within a Zone", () => {
    const invalidConfig = structuredClone(config);
    const [first, second] = invalidConfig.areas[0]!.zones[0]!.subZones;
    second!.element_id = first!.element_id;
    second!.model = first!.model;

    expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("rejects duplicate Lighting ids", () => {
    const invalidConfig = structuredClone(config);
    invalidConfig.lightings[1]!.id = invalidConfig.lightings[0]!.id;

    expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("rejects Lighting Sub-Zones with mixed models", () => {
    const invalidConfig = structuredClone(config);
    const lighting = invalidConfig.lightings.find(
      (item) => item.subZones[0]?.model === "main-model",
    )!;
    lighting.subZones.push({
      element_id: "sub_zone_mixed",
      model: "clubhouse-model",
      intensity: 1,
      animation_duration_ms: 500,
    });

    expect(() => AppConfigSchema.parse(invalidConfig)).toThrow();
  });
});

describe("Tablet request validation", () => {
  test("accepts known Area and Zone IDs", () => {
    expect(parseAreaActivationRequest({ area_id: 1 }, config)).toEqual({
      area_id: 1,
    });
    expect(
      parseZoneActivationRequest(
        { zone_id: "ambient-marina-state" },
        config,
      ),
    ).toEqual({ zone_id: "ambient-marina-state" });
  });

  test("accepts known Lighting ids", () => {
    expect(
      parseLightingControlRequest(
        { lighting_id: "marina-reserve", action: "activate" },
        config,
      ),
    ).toEqual({ lighting_id: "marina-reserve", action: "activate" });
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
          zone_id: "ambient-marina-state",
          element_id: "corridor_wall_left",
          model: "main-model",
          action: "activate",
          intensity: 0.5,
          animation_duration_ms: 500,
        },
        config,
      ),
    ).toThrow();
  });

  test("requires model to disambiguate Sub-Zones", () => {
    expect(
      parseSubZoneControlRequest(
        {
          zone_id: "ambient-marina-state",
          element_id: "sub_zone_10",
          model: "main-model",
          action: "activate",
          intensity: 0.5,
          animation_duration_ms: 500,
        },
        config,
      ),
    ).toEqual({
      zone_id: "ambient-marina-state",
      element_id: "sub_zone_10",
      model: "main-model",
      action: "activate",
      intensity: 0.5,
      animation_duration_ms: 500,
    });
  });
});
