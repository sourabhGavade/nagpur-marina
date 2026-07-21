import type { SubZone } from "../utils/types.ts";

export const foyerAccent: SubZone = {
  element_id: "foyer_accent",
  color_hex: "#FFB347",
  intensity_percent: 80,
  animation_duration_ms: 500,
  tabletImageUrl: "/images/sub-zones/foyer-accent.jpg",
};

export const foyerCeiling: SubZone = {
  element_id: "foyer_ceiling",
  color_hex: "#FFF4D6",
  intensity_percent: 65,
  animation_duration_ms: 700,
  tabletImageUrl: "/images/sub-zones/foyer-ceiling.jpg",
};

export const corridorWallLeft: SubZone = {
  element_id: "corridor_wall_left",
  color_hex: "#4A90E2",
  intensity_percent: 100,
  animation_duration_ms: 750,
  tabletImageUrl: "/images/sub-zones/corridor-wall-left.jpg",
};

export const corridorWallRight: SubZone = {
  element_id: "corridor_wall_right",
  color_hex: "#7B61FF",
  intensity_percent: 90,
  animation_duration_ms: 750,
  tabletImageUrl: "/images/sub-zones/corridor-wall-right.jpg",
};

export const gallerySpotlight: SubZone = {
  element_id: "gallery_spotlight",
  color_hex: "#FFFFFF",
  intensity_percent: 85,
  animation_duration_ms: 400,
  tabletImageUrl: "/images/sub-zones/gallery-spotlight.jpg",
};

export const loungeAmbient: SubZone = {
  element_id: "lounge_ambient",
  color_hex: "#FF6B6B",
  intensity_percent: 60,
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
