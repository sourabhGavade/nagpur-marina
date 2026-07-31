import { LightingModel } from "./types";

export const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (typeof window === "undefined"
    ? "http://localhost:4000"
    : `${window.location.protocol}//${window.location.hostname}:4000`);

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
