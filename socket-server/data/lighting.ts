import {
  subZoneMainModel1,
  subZoneMainModel2,
  subZoneMainModel3,
  subZoneMainModel4,
  subZoneMainModel5,
  subZoneMainModel6,
  subZoneMainModel7,
  subZoneMainModel8,
  subZoneMainModel9,
  subZoneMainModel10,
  subZoneMainModel11,
  subZoneMainModel12,
  subZoneMainModel13,
  subZoneMainModel14,
  subZoneMainModel15,
  subZoneMainModel16,
  subZoneMainModel17,
  subZoneMainModel18,
  subZoneMainModel19,
  subZoneMainModel20,
  subZoneMainModel21,
  subZoneMainModel22,
  subZoneMainModel23,
  subZoneMainModel24,
  subZoneClubhouseModel1,
  subZoneClubhouseModel2,
  subZoneClubhouseModel3,
  subZoneClubhouseModel4,
  subZoneClubhouseModel5,
  subZoneClubhouseModel6,
  subZoneClubhouseModel7,
} from "./sub-zones.ts";
import type { Lighting } from "../utils/types.ts";

const marinaReserve: Lighting = {
  id: "marina-reserve",
  name: "Marina Reserve",
  sequence_order: 1,
  subZones: [subZoneMainModel1, subZoneMainModel12],
};

const marinaEuphoria: Lighting = {
  id: "marina-euphoria",
  name: "Marina Euphoria",
  sequence_order: 2,
  subZones: [subZoneMainModel2],
};

const marinaGrove: Lighting = {
  id: "marina-grove",
  name: "Marina Grove",
  sequence_order: 3,
  subZones: [
    subZoneMainModel3,
    subZoneMainModel14,
    subZoneMainModel15,
    subZoneMainModel16,
    subZoneMainModel17,
    subZoneMainModel18,
  ],
};

const marinaBayview: Lighting = {
  id: "marina-bayview",
  name: "Marina Bayview",
  sequence_order: 4,
  subZones: [subZoneMainModel4, subZoneMainModel19, subZoneMainModel20],
};

const marinaGrand: Lighting = {
  id: "marina-grand",
  name: "Marina Grand",
  sequence_order: 5,
  subZones: [subZoneMainModel5, subZoneMainModel21],
};

const marinaRiviera: Lighting = {
  id: "marina-riviera",
  name: "Marina Riviera",
  sequence_order: 6,
  subZones: [subZoneMainModel6, subZoneMainModel22],
};

const activityZone: Lighting = {
  id: "activity-zone",
  name: "Activity Zone",
  sequence_order: 7,
  subZones: [subZoneMainModel7],
};

const serenityZone: Lighting = {
  id: "serenity-zone",
  name: "Serenity Zone",
  sequence_order: 8,
  subZones: [subZoneMainModel8],
};

const waterfrontClubhouse: Lighting = {
  id: "waterfront-clubhouse",
  name: "Waterfront + Clubhouse",
  sequence_order: 9,
  subZones: [subZoneMainModel9],
};

const mainApproachRoad: Lighting = {
  id: "main-approach-road",
  name: "Main & Approach Road",
  sequence_order: 11,
  subZones: [subZoneMainModel10],
};

const projectBoundary: Lighting = {
  id: "project-boundary",
  name: "Project Boundary",
  sequence_order: 12,
  subZones: [subZoneMainModel11, subZoneMainModel24],
};

const orchardsParks: Lighting = {
  id: "orchards-parks",
  name: "Orchards & Parks",
  sequence_order: 10,
  subZones: [
    subZoneMainModel12,
    subZoneMainModel13,
    subZoneMainModel14,
    subZoneMainModel15,
    subZoneMainModel16,
    subZoneMainModel17,
    subZoneMainModel18,
    subZoneMainModel19,
    subZoneMainModel20,
    subZoneMainModel21,
    subZoneMainModel22,
    subZoneMainModel23,
  ],
};

const roadLights: Lighting = {
  id: "road-lights",
  name: "Road Lights",
  sequence_order: 13,
  subZones: [subZoneMainModel24],
};

const beach: Lighting = {
  id: "beach",
  name: "Beach",
  sequence_order: 1,
  subZones: [subZoneClubhouseModel1],
};

const clubhouse: Lighting = {
  id: "clubhouse",
  name: "Clubhouse",
  sequence_order: 2,
  subZones: [subZoneClubhouseModel3],
};

const infinityPool: Lighting = {
  id: "infinity-pool",
  name: "Infinity Pool",
  sequence_order: 3,
  subZones: [subZoneClubhouseModel2],
};

const lazyRiver: Lighting = {
  id: "lazy-river",
  name: "Lazy River",
  sequence_order: 4,
  subZones: [subZoneClubhouseModel4],
};

const celebrationGarden: Lighting = {
  id: "celebration-garden",
  name: "Celebration Garden",
  sequence_order: 5,
  subZones: [subZoneClubhouseModel5],
};

const clubhouseBoundary: Lighting = {
  id: "clubhouse-boundary",
  name: "Clubhouse Boundary",
  sequence_order: 6,
  subZones: [subZoneClubhouseModel6],
};

const roadsAndCars: Lighting = {
  id: "roads-and-cars",
  name: "Roads & Cars",
  sequence_order: 7,
  subZones: [subZoneClubhouseModel7],
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
  roadsAndCars,
];
