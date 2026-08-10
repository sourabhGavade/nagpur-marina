import type { Area } from "../utils/types.ts";
import {
  activeZone,
  clubhouseInterior,
  lifestyleAnchorsIntro,
  marinaBayview,
  marinaEuphoria,
  marinaGrand,
  marinaGrove,
  marinaReserve,
  marinaHorizon,
  masterplanReveal,
  neighbourhoodParksOrchards,
  serenityZone,
  waterfrontAmenities,
  waterfrontBeach,
  whyNagpurMarina,
} from "./zones.ts";

const contextAndVision: Area = {
  id: 1,
  sequence_order: 1,
  name: "Context & Vision",
  zones: [whyNagpurMarina, masterplanReveal],
};

const lifeStyleAndAmenities: Area = {
  id: 2,
  sequence_order: 2,
  name: "Lifestyle & Amenities",
  zones: [
    lifestyleAnchorsIntro,
    waterfrontBeach,
    waterfrontAmenities,
    clubhouseInterior,
    activeZone,
    serenityZone,
    neighbourhoodParksOrchards,
  ],
};

const theMarinaExperience: Area = {
  id: 3,
  sequence_order: 3,
  name: "The Marina Experience",
  zones: [
    marinaReserve,
    marinaEuphoria,
    marinaGrove,
    marinaBayview,
    marinaGrand,
    marinaHorizon,
  ],
};

export const areas: Area[] = [
  contextAndVision,
  lifeStyleAndAmenities,
  theMarinaExperience,
];
