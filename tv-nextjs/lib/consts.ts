export const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (typeof window === "undefined"
    ? "http://localhost:4000"
    : `${window.location.protocol}//${window.location.hostname}:4000`);

export const idleVideoUrl = "/zone-tv-videos/marina-reserve.mp4";
