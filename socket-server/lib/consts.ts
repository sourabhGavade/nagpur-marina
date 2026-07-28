export const EXPECTED_HARDWARE_CLIENTS = 2;

export const HARDWARE_CLIENT_MAIN_MODEL = "raspberry-pi-1";
export const HARDWARE_CLIENT_CLUBHOUSE = "raspberry-pi-2";

export const LIGHTING_MODEL_TO_HARDWARE_CLIENT = {
  "main-model": HARDWARE_CLIENT_MAIN_MODEL,
  "clubhouse-model": HARDWARE_CLIENT_CLUBHOUSE,
} as const;
