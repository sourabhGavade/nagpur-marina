export type LightingModel = "main-model" | "clubhouse-model";

export type ActionState =
  | "idle"
  | "starting"
  | "playing"
  | "stopping"
  | "error";

export interface SubZone {
  element_id: string;
  intensity: number;
  model: LightingModel;
  animation_duration_ms: number;
}

export interface Zone {
  id: string;
  sequence_order: number;
  name: string;
  video_url: string;
  video_duration_ms: number;
  video_crossfade_duration_ms: number;
  tabletImageUrl: string;
  subZones: SubZone[];
}

export interface Area {
  id: number;
  sequence_order: number;
  name: string;
  zones: Zone[];
}

export interface Lighting {
  id: string;
  name: string;
  sequence_order: number;
  subZones: SubZone[];
}

export interface AppConfig {
  areas: Area[];
  lightings: Lighting[];
}

export type ConnectionState = "idle" | "connecting" | "connected" | "error";

export type CommandResult =
  | { status: "success"; transaction_id: string }
  | {
      status: "error";
      transaction_id: string;
      error_code: string;
      message: string;
    };

export interface RuntimeStatus {
  mode: "idle" | "area" | "zone" | "subzone" | "lighting";
  playback_state: "idle" | "playing" | "paused";
  muted: boolean;
  active_area_id: number | null;
  active_zone_id: string | null;
  active_lighting_id: string | null;
  active_element_id: string | null;
}

export interface TabletContextValue {
  layout: AppConfig | null;
  connectionState: ConnectionState;
  hardwareOnline: boolean | null;
  displayOnline: boolean | null;
  runtimeStatus: RuntimeStatus;
  errorMessage: string;
  tabletLocked: boolean;
  connect: () => void;
  disconnect: () => void;
  activateArea: (areaId: Area["id"]) => Promise<CommandResult>;
  activateZone: (zoneId: Zone["id"]) => Promise<CommandResult>;
  controlLighting: (
    lightingId: Lighting["id"],
    action: "activate" | "deactivate",
  ) => Promise<CommandResult>;
  pauseSequence: () => Promise<CommandResult>;
  resumeSequence: () => Promise<CommandResult>;
  muteSequence: () => Promise<CommandResult>;
  unmuteSequence: () => Promise<CommandResult>;
  stopSequence: () => Promise<CommandResult>;
  clearLights: () => Promise<CommandResult>;
}
