export type PlaybackState =
  | "idle"
  | "preparing"
  | "playing"
  | "paused"
  | "error";

export interface PrepareVideoPayload {
  transaction_id: string;
  zone_id: string;
  video_url: string;
}

export interface PlayVideoPayload {
  transaction_id: string;
  zone_id: string;
  execute_at_ms: number;
  video_duration_ms: number;
  video_crossfade_duration_ms: number;
  loop: boolean;
}

export interface VideoControlPayload {
  transaction_id: string;
}
