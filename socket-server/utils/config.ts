import { areas } from "../data/areas.ts";
import type { AppConfig } from "./types.ts";
import { validateConfig } from "./validation.ts";

const rawConfig: AppConfig = {
  areas,
};

export const config = validateConfig(rawConfig);
