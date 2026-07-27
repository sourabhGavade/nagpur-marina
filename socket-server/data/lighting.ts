import {
  corridorWallLeft,
  corridorWallRight,
  foyerAccent,
  foyerCeiling,
  gallerySpotlight,
  loungeAmbient,
} from "./sub-zones.ts";
import type { Lighting } from "../utils/types.ts";

export const lighting1: Lighting[] = [
  {
    id: "lighting-1",
    name: "Lighting 1",
    sequence_order: 1,
    model: "main-model",
    subZones: [corridorWallLeft, corridorWallRight],
  },
];

export const lighting2: Lighting[] = [
  {
    id: "lighting-2",
    name: "Lighting 2",
    sequence_order: 2,
    model: "clubhouse",
    subZones: [foyerAccent, foyerCeiling],
  },
];

export const lighting3: Lighting[] = [
  {
    id: "lighting-3",
    name: "Lighting 3",
    sequence_order: 3,
    model: "clubhouse",
    subZones: [gallerySpotlight, loungeAmbient],
  },
];
