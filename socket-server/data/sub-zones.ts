import type { SubZone } from "../utils/types.ts";

export const foyerAccent: SubZone = {
  element_id: "foyer_accent",
  intensity: 1,
  animation_duration_ms: 500,
  tabletImageUrl: "/images/sub-zones/foyer-accent.jpg",
};

export const foyerCeiling: SubZone = {
  element_id: "foyer_ceiling",
  intensity: 1,
  animation_duration_ms: 700,
  tabletImageUrl: "/images/sub-zones/foyer-ceiling.jpg",
};

export const corridorWallLeft: SubZone = {
  element_id: "corridor_wall_left",
  intensity: 1,
  animation_duration_ms: 750,
  tabletImageUrl: "/images/sub-zones/corridor-wall-left.jpg",
};

export const corridorWallRight: SubZone = {
  element_id: "corridor_wall_right",
  intensity: 1,
  animation_duration_ms: 750,
  tabletImageUrl: "/images/sub-zones/corridor-wall-right.jpg",
};

export const gallerySpotlight: SubZone = {
  element_id: "gallery_spotlight",
  intensity: 1,
  animation_duration_ms: 400,
  tabletImageUrl: "/images/sub-zones/gallery-spotlight.jpg",
};

export const loungeAmbient: SubZone = {
  element_id: "lounge_ambient",
  intensity: 1,
  animation_duration_ms: 1_000,
  tabletImageUrl: "/images/sub-zones/lounge-ambient.jpg",
};

export const subZones: SubZone[] = [
  foyerAccent,
  foyerCeiling,
  corridorWallLeft,
  corridorWallRight,
  gallerySpotlight,
  loungeAmbient,
];
