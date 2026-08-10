export const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (typeof window === "undefined"
    ? "http://localhost:4000"
    : `${window.location.protocol}//${window.location.hostname}:4000`);

export const idleVideoUrl = "/zone-tv-videos/1-idle-state.mp4"

/** Crossfade when returning from content video to the idle loop. */
export const idleCrossfadeDurationMs = 500;
