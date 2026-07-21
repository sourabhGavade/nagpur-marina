import type { Area } from "../utils/types.ts";
import {
  corridorReveal,
  foyerWelcome,
  galleryShowcase,
  loungeFinale,
} from "./zones.ts";

export const entranceExperience: Area = {
  id: 1,
  sequence_order: 1,
  name: "Entrance Experience",
  tabletImageUrl: "/images/areas/entrance-experience.png",
  zones: [foyerWelcome, corridorReveal],
};

export const galleryExperience: Area = {
  id: 2,
  sequence_order: 2,
  name: "Gallery Experience",
  tabletImageUrl: "/images/areas/gallery-experience.png",
  zones: [galleryShowcase, loungeFinale],
};

export const areas: Area[] = [entranceExperience, galleryExperience];
