import { LightingModel } from "./types";

/**
 * Baked at `next build` from ENVs/ENVs/tablet-nextjs/.env
 * (Caddy Socket.IO: https://192.168.0.111:5001).
 *
 * If this is missing, the browser falls back to hostname:4000 which breaks
 * when the UI is HTTPS via Caddy and sockets only exist as HTTPS on :5001.
 */
const configuredSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

export const socketUrl =
  configuredSocketUrl && configuredSocketUrl.length > 0
    ? configuredSocketUrl
    : typeof window === "undefined"
      ? "http://localhost:4000"
      : `${window.location.protocol}//${window.location.hostname}:5001`;

/** Same remote lock gist the socket-server polls; `enabled: false` locks the experience. */
export const REMOTE_ENABLE_CONFIG_URL =
  "https://gist.githubusercontent.com/sourabhGavade/7f3e32a140551f4af1841fb666033f1f/raw/app-config.json";

export const sections = [
  {
    key: "areas",
    number: "01",
    title: "Chapters",
    description: "Browse and activate experience areas",
  },
  {
    key: "zones",
    number: "02",
    title: "Zones",
    description: "View the zones available in each area",
  },
  {
    key: "lighting",
    number: "03",
    title: "Lighting",
    description: "Toogle the lighting directly.",
  },
] as const;

export const MODEL_LABELS: Record<LightingModel, string> = {
  "main-model": "Main Model",
  "clubhouse-model": "Clubhouse",
};
