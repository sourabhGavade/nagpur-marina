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

// ================ REMOTE ENABLEMENT CONFIG ================
export const REMOTE_ENABLE_CONFIG_URL =
  "https://gist.githubusercontent.com/sourabhGavade/7f3e32a140551f4af1841fb666033f1f/raw/app-config.json";
export const REMOTE_ENABLE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
