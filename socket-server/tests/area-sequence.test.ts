import { describe, expect, test } from "bun:test";
import {
  buildAreaSequence,
  getTransitionOffset,
} from "../controllers/area-sequence-controller.ts";
import { config } from "../utils/config.ts";

const lifestyleZoneIdsInOrder = [
  "lifestyle-anchors-intro",
  "waterfront-beach",
  "waterfront-amenities",
  "clubhouse-interior",
  "active-zone",
  "serenity-zone",
  "neighbourhood-parks-orchards",
];

const contextZoneIdsInOrder = ["why-nagpur-marina", "masterplan-reveal"];

describe("Area sequence planning", () => {
  test("plays only Zones within the selected Area", () => {
    const sequence = buildAreaSequence(config, 2);

    expect(sequence.map(({ zone }) => zone.id)).toEqual(
      lifestyleZoneIdsInOrder,
    );
    expect(sequence.every(({ area }) => area.id === 2)).toBe(true);
  });

  test("sorts Zones by sequence_order within the selected Area", () => {
    const unordered = structuredClone(config);
    unordered.areas.reverse();
    for (const area of unordered.areas) area.zones.reverse();

    const sequence = buildAreaSequence(unordered, 1);

    expect(sequence.map(({ zone }) => zone.id)).toEqual(contextZoneIdsInOrder);
  });

  test("starts a crossfade before the current video ends", () => {
    const firstZone = config.areas[0]!.zones[0]!;

    expect(getTransitionOffset(firstZone)).toBe(
      firstZone.video_duration_ms - firstZone.video_crossfade_duration_ms,
    );
  });
});
