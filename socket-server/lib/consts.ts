import {
  subZoneMainModel10,
  subZoneMainModel24,
  subZoneMainModel11,
  subZoneClubhouseModel1,
  subZoneClubhouseModel5,
  subZoneClubhouseModel4,
  subZoneClubhouseModel7,
  subZoneClubhouseModel3,
  subZoneClubhouseModel2,
} from "../data/sub-zones";

// ================ HARDWARE CONFIG ================
export const EXPECTED_HARDWARE_CLIENTS = 2;

export const HARDWARE_CLIENT_MAIN_MODEL = "raspberry-pi-1";
export const HARDWARE_CLIENT_CLUBHOUSE = "raspberry-pi-2";

// ================ LIGHTING CONFIG ================
export const LIGHTING_MODEL_TO_HARDWARE_CLIENT = {
  "main-model": HARDWARE_CLIENT_MAIN_MODEL,
  "clubhouse-model": HARDWARE_CLIENT_CLUBHOUSE,
} as const;

// ================ ZONE VIDEO AND IMAGE CONFIG ================
export const zoneTabletImageBaseUrl = "/zone-tablet-images";
export const zoneTVVideoBaseUrl = "/zone-tv-videos";

/** After natural finish, hold last video frame before idle loop. */
export const IDLE_HOLD_LAST_FRAME_MS = 60_000; // 1 minute

// ================ REMOTE ENABLEMENT CONFIG ================
export const REMOTE_ENABLE_CONFIG_URL =
  "https://gist.githubusercontent.com/sourabhGavade/7f3e32a140551f4af1841fb666033f1f/raw/app-config.json";
export const REMOTE_ENABLE_CHECK_INTERVAL_MS = 60 * 1000; // 1 hour

// ================== IDLE LIGHTS CONFIG ==================
export const IDLE_LIGHTS_CONFIG = [
  subZoneMainModel10(),
  subZoneMainModel11(),
  subZoneMainModel24(),
  subZoneClubhouseModel1(),
  subZoneClubhouseModel2(),
  subZoneClubhouseModel3(),
  subZoneClubhouseModel4(),
  subZoneClubhouseModel5(),
  subZoneClubhouseModel7(),
] as const;
