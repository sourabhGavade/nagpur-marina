import { areas } from "../data/areas.ts";
import { lightings } from "../data/lighting.ts";
import type { AppConfig } from "./types.ts";
import { validateConfig } from "./validation.ts";

const rawConfig: AppConfig = {
  areas,
  lightings,
};

export const config = validateConfig(rawConfig);
