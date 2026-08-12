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

/** Remote lock gist polled by the socket-server; tablets are rejected when locked. */
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
