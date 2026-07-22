import {
  corridorWallLeft,
  corridorWallRight,
  foyerAccent,
  foyerCeiling,
  gallerySpotlight,
  loungeAmbient,
} from "./sub-zones.ts";
import type { Zone } from "../utils/types.ts";

export const foyerWelcome: Zone = {
  id: "foyer-welcome",
  sequence_order: 1,
  name: "Foyer Welcome",
  video_url: "/10_sec_video.mp4",
  video_duration_ms: 10_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/foyer-welcome.jpg",
  subZones: [foyerAccent, foyerCeiling],
};

export const corridorReveal: Zone = {
  id: "corridor-reveal",
  sequence_order: 2,
  name: "Corridor Reveal",
  video_url: "/14_sec_video.mp4",
  video_duration_ms: 14_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/corridor-reveal.jpg",
  subZones: [corridorWallLeft, corridorWallRight],
};

export const galleryShowcase: Zone = {
  id: "gallery-showcase",
  sequence_order: 1,
  name: "Gallery Showcase",
  video_url: "/19_sec_video.mp4",
  video_duration_ms: 19_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/gallery-showcase.jpg",
  subZones: [gallerySpotlight],
};

export const loungeFinale: Zone = {
  id: "lounge-finale",
  sequence_order: 2,
  name: "Lounge Finale",
  video_url: "/20_sec_video.mp4",
  video_duration_ms: 20_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/lounge-finale.jpg",
  subZones: [loungeAmbient],
};

export const zones: Zone[] = [
  foyerWelcome,
  corridorReveal,
  galleryShowcase,
  loungeFinale,
];
