import { describe, expect, test } from "bun:test";
import {
  buildAreaSequence,
  getTransitionOffset,
} from "../controllers/area-sequence-controller.ts";
import { config } from "../utils/config.ts";

describe("Area sequence planning", () => {
  test("starts at the selected Area and wraps globally", () => {
    const sequence = buildAreaSequence(config, 2);

    expect(sequence.map(({ zone }) => zone.id)).toEqual([
      "gallery-showcase",
      "lounge-finale",
      "foyer-welcome",
      "corridor-reveal",
    ]);
  });

  test("sorts Areas and Zones by sequence_order", () => {
    const unordered = structuredClone(config);
    unordered.areas.reverse();
    for (const area of unordered.areas) area.zones.reverse();

    const sequence = buildAreaSequence(unordered, 1);

    expect(sequence.map(({ zone }) => zone.id)).toEqual([
      "foyer-welcome",
      "corridor-reveal",
      "gallery-showcase",
      "lounge-finale",
    ]);
  });

  test("starts a crossfade before the current video ends", () => {
    const firstZone = config.areas[0]!.zones[0]!;

    expect(getTransitionOffset(firstZone)).toBe(11_500);
  });
});
