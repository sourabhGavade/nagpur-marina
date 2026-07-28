import { describe, expect, test } from "bun:test";
import {
  buildAreaSequence,
  getTransitionOffset,
} from "../controllers/area-sequence-controller.ts";
import { config } from "../utils/config.ts";

const allZoneIdsInOrder = [
  "ambient-marina-state",
  "why-nagpur-marina",
  "masterplan-reveal",
  "lifestyle-anchors-intro",
  "waterfront-beach",
  "waterfront-amenities",
  "clubhouse-interior",
  "active-zone",
  "serenity-zone",
  "neighbourhood-parks-orchards",
  "marina-reserve",
  "marina-euphoria",
  "marina-grove",
  "marina-bayview",
  "marina-grand",
  "marina-riviera",
];

describe("Area sequence planning", () => {
  test("starts at the selected Area and wraps globally", () => {
    const sequence = buildAreaSequence(config, 2);

    expect(sequence.map(({ zone }) => zone.id)).toEqual([
      ...allZoneIdsInOrder.slice(3),
      ...allZoneIdsInOrder.slice(0, 3),
    ]);
  });

  test("sorts Areas and Zones by sequence_order", () => {
    const unordered = structuredClone(config);
    unordered.areas.reverse();
    for (const area of unordered.areas) area.zones.reverse();

    const sequence = buildAreaSequence(unordered, 1);

    expect(sequence.map(({ zone }) => zone.id)).toEqual(allZoneIdsInOrder);
  });

  test("starts a crossfade before the current video ends", () => {
    const firstZone = config.areas[0]!.zones[0]!;

    expect(getTransitionOffset(firstZone)).toBe(
      firstZone.video_duration_ms - firstZone.video_crossfade_duration_ms,
    );
  });
});
