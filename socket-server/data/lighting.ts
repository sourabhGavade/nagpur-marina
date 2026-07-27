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
import type { Lighting } from "../utils/types.ts";

const marinaReserve: Lighting = {
  id: "marina-reserve",
  name: "Marina Reserve",
  sequence_order: 1,
  model: "main-model",
  subZones: [corridorWallLeft, corridorWallRight],
};

const marinaEuphoria: Lighting = {
  id: "marina-euphoria",
  name: "Marina Euphoria",
  sequence_order: 2,
  model: "main-model",
  subZones: [dummySubZone7, dummySubZone14],
};

const marinaGrove: Lighting = {
  id: "marina-grove",
  name: "Marina Grove",
  sequence_order: 3,
  model: "main-model",
  subZones: [dummySubZone3],
};

const marinaBayview: Lighting = {
  id: "marina-bayview",
  name: "Marina Bayview",
  sequence_order: 4,
  model: "main-model",
  subZones: [dummySubZone19, dummySubZone1],
};

const marinaGrand: Lighting = {
  id: "marina-grand",
  name: "Marina Grand",
  sequence_order: 5,
  model: "main-model",
  subZones: [dummySubZone11],
};

const marinaRiviera: Lighting = {
  id: "marina-riviera",
  name: "Marina Riviera",
  sequence_order: 6,
  model: "main-model",
  subZones: [dummySubZone5, dummySubZone18],
};

const activityZone: Lighting = {
  id: "activity-zone",
  name: "Activity Zone",
  sequence_order: 7,
  model: "main-model",
  subZones: [dummySubZone9],
};

const serenityZone: Lighting = {
  id: "serenity-zone",
  name: "Serenity Zone",
  sequence_order: 8,
  model: "main-model",
  subZones: [dummySubZone16],
};

const waterfrontClubhouse: Lighting = {
  id: "waterfront-clubhouse",
  name: "Waterfront + Clubhouse",
  sequence_order: 9,
  model: "main-model",
  subZones: [dummySubZone2, dummySubZone12],
};

const orchardsParks: Lighting = {
  id: "orchards-parks",
  name: "Orchards & Parks",
  sequence_order: 10,
  model: "main-model",
  subZones: [dummySubZone8],
};

const mainApproachRoad: Lighting = {
  id: "main-approach-road",
  name: "Main & Approach Road",
  sequence_order: 11,
  model: "main-model",
  subZones: [dummySubZone20],
};

const projectBoundary: Lighting = {
  id: "project-boundary",
  name: "Project Boundary",
  sequence_order: 12,
  model: "main-model",
  subZones: [dummySubZone4],
};

const roadLights: Lighting = {
  id: "road-lights",
  name: "Road Lights",
  sequence_order: 13,
  model: "main-model",
  subZones: [dummySubZone10],
};

const beach: Lighting = {
  id: "beach",
  name: "Beach",
  sequence_order: 1,
  model: "clubhouse",
  subZones: [foyerAccent, foyerCeiling],
};

const clubhouse: Lighting = {
  id: "clubhouse",
  name: "Clubhouse",
  sequence_order: 2,
  model: "clubhouse",
  subZones: [gallerySpotlight, loungeAmbient],
};

const infinityPool: Lighting = {
  id: "infinity-pool",
  name: "Infinity Pool",
  sequence_order: 3,
  model: "clubhouse",
  subZones: [dummySubZone6],
};

const lazyRiver: Lighting = {
  id: "lazy-river",
  name: "Lazy River",
  sequence_order: 4,
  model: "clubhouse",
  subZones: [dummySubZone13],
};

const celebrationGarden: Lighting = {
  id: "celebration-garden",
  name: "Celebration Garden",
  sequence_order: 5,
  model: "clubhouse",
  subZones: [dummySubZone17],
};

const clubhouseBoundary: Lighting = {
  id: "clubhouse-boundary",
  name: "Clubhouse Boundary",
  sequence_order: 6,
  model: "clubhouse",
  subZones: [dummySubZone15],
};

export const lightings: Lighting[] = [
  marinaReserve,
  marinaEuphoria,
  marinaGrove,
  marinaBayview,
  marinaGrand,
  marinaRiviera,
  activityZone,
  serenityZone,
  waterfrontClubhouse,
  orchardsParks,
  mainApproachRoad,
  projectBoundary,
  roadLights,
  beach,
  clubhouse,
  infinityPool,
  lazyRiver,
  celebrationGarden,
  clubhouseBoundary,
];
