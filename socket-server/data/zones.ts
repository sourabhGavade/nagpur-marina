import {
  corridorWallLeft,
  corridorWallRight,
  dummySubZone1,
  dummySubZone2,
  dummySubZone3,
  dummySubZone4,
  dummySubZone5,
  dummySubZone6,
  dummySubZone7,
  dummySubZone8,
  dummySubZone9,
  dummySubZone10,
  dummySubZone11,
  dummySubZone12,
  dummySubZone13,
  dummySubZone14,
  dummySubZone15,
  dummySubZone16,
  dummySubZone17,
  dummySubZone18,
  dummySubZone19,
  dummySubZone20,
  foyerAccent,
  foyerCeiling,
  gallerySpotlight,
  loungeAmbient,
} from "./sub-zones.ts";
import type { Zone } from "../utils/types.ts";

const sharedVideoUrl = "/10_sec_video.mp4";
const sharedVideoDurationMs = 10_000;
const sharedTabletImageUrl = "/images/zones/foyer-welcome.jpg";

export const whyNagpurMarina: Zone = {
  id: "why-nagpur-marina",
  sequence_order: 1,
  name: "Why Nagpur Marina",
  video_url: "/10_sec_video.mp4",
  video_duration_ms: 10_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/foyer-welcome.jpg",
  subZones: [foyerAccent, foyerCeiling],
};

export const masterplanReveal: Zone = {
  id: "masterplan-reveal",
  sequence_order: 2,
  name: "Masterplan Reveal",
  video_url: "/14_sec_video.mp4",
  video_duration_ms: 14_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/corridor-reveal.jpg",
  subZones: [corridorWallLeft, corridorWallRight],
};

export const lifestyleAnchorsIntro: Zone = {
  id: "lifestyle-anchors-intro",
  sequence_order: 1,
  name: "Lifestyle Anchors Intro",
  video_url: "/19_sec_video.mp4",
  video_duration_ms: 19_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/gallery-showcase.jpg",
  subZones: [gallerySpotlight, dummySubZone16],
};

export const waterfrontBeach: Zone = {
  id: "waterfront-beach",
  sequence_order: 2,
  name: "Waterfront Beach",
  video_url: "/20_sec_video.mp4",
  video_duration_ms: 20_000,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: "/images/zones/lounge-finale.jpg",
  subZones: [loungeAmbient, dummySubZone14],
};

export const waterfrontAmenities: Zone = {
  id: "waterfront-amenities",
  sequence_order: 3,
  name: "Waterfront Amenities",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone4, dummySubZone17],
};

export const clubhouseInterior: Zone = {
  id: "clubhouse-interior",
  sequence_order: 4,
  name: "Clubhouse Interior",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone11],
};

export const activeZone: Zone = {
  id: "active-zone",
  sequence_order: 5,
  name: "Active Zone",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone2, dummySubZone19],
};

export const serenityZone: Zone = {
  id: "serenity-zone",
  sequence_order: 6,
  name: "Serenity Zone",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone8],
};

export const neighbourhoodParksOrchards: Zone = {
  id: "neighbourhood-parks-orchards",
  sequence_order: 7,
  name: "Neighbourhood Parks + Orchards",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone13, dummySubZone6],
};

export const marinaReserve: Zone = {
  id: "marina-reserve",
  sequence_order: 1,
  name: "Marina Reserve",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone1],
};

export const marinaEuphoria: Zone = {
  id: "marina-euphoria",
  sequence_order: 2,
  name: "Marina Euphoria",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone15, dummySubZone9],
};

export const marinaGrove: Zone = {
  id: "marina-grove",
  sequence_order: 3,
  name: "Marina Grove",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone20],
};

export const marinaBayview: Zone = {
  id: "marina-bayview",
  sequence_order: 4,
  name: "Marina Bayview",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone3, dummySubZone12],
};

export const marinaGrand: Zone = {
  id: "marina-grand",
  sequence_order: 5,
  name: "Marina Grand",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone7],
};

export const marinaRiviera: Zone = {
  id: "marina-riviera",
  sequence_order: 6,
  name: "Marina Riviera",
  video_url: sharedVideoUrl,
  video_duration_ms: sharedVideoDurationMs,
  video_crossfade_duration_ms: 500,
  tabletImageUrl: sharedTabletImageUrl,
  subZones: [dummySubZone18, dummySubZone5, dummySubZone10],
};

export const zones: Zone[] = [
  whyNagpurMarina,
  masterplanReveal,
  lifestyleAnchorsIntro,
  waterfrontBeach,
  waterfrontAmenities,
  clubhouseInterior,
  activeZone,
  serenityZone,
  neighbourhoodParksOrchards,
  marinaReserve,
  marinaEuphoria,
  marinaGrove,
  marinaBayview,
  marinaGrand,
  marinaRiviera,
];
