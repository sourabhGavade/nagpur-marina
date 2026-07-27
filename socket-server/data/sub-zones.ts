import type { SubZone } from "../utils/types.ts";

export const foyerAccent: SubZone = {
  element_id: "foyer_accent",
  intensity: 1,
  animation_duration_ms: 500,
};

export const foyerCeiling: SubZone = {
  element_id: "foyer_ceiling",
  intensity: 1,
  animation_duration_ms: 700,
};

export const corridorWallLeft: SubZone = {
  element_id: "corridor_wall_left",
  intensity: 1,
  animation_duration_ms: 750,
};

export const corridorWallRight: SubZone = {
  element_id: "corridor_wall_right",
  intensity: 1,
  animation_duration_ms: 750,
};

export const gallerySpotlight: SubZone = {
  element_id: "gallery_spotlight",
  intensity: 1,
  animation_duration_ms: 400,
};

export const loungeAmbient: SubZone = {
  element_id: "lounge_ambient",
  intensity: 1,
  animation_duration_ms: 1_000,
};

export const subZones: SubZone[] = [
  foyerAccent,
  foyerCeiling,
  corridorWallLeft,
  corridorWallRight,
  gallerySpotlight,
  loungeAmbient,
];
