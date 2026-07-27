/**
 * One controllable light/physical element inside a Zone.
 * SubZone is the lighting entity; there is no separate Light entity.
 */
export interface SubZone {
  element_id: string;
  intensity: number;
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

export type LightingModel = "main-model" | "clubhouse";

export interface Lighting {
  id: string;
  name: string;
  sequence_order: number;
  model: LightingModel;
  subZones: SubZone[];
}

export interface AppConfig {
  areas: Area[];
  lightings: Lighting[];
}

export type ClientRole = "tablet" | "hardware" | "display";

export interface SocketHandshakeAuth {
  role: ClientRole;
  client_id: string;
}

export interface SocketData extends SocketHandshakeAuth {}

export type LightAction = "activate" | "deactivate";

/**
 * Transport representation of a SubZone sent to the Raspberry Pi.
 */
export interface SubZoneHardwareState extends SubZone {
  action: LightAction;
}

export type HardwareStateScope =
  | "area"
  | "zone"
  | "subzone"
  | "lighting"
  | "system";

export interface HardwareApplyStatePayload {
  transaction_id: string;
  area_id: Area["id"] | null;
  zone_id: Zone["id"] | null;
  lighting_id: Lighting["id"] | null;
  scope: HardwareStateScope;
  mode: "replace";
  execute_at_ms: number;
  /**
   * One item per SubZone. A single SubZone command has one item;
   * an empty array switches all registered outputs off.
   */
  lights: SubZoneHardwareState[];
}

export interface AreaActivationRequest {
  area_id: Area["id"];
}

export interface ZoneActivationRequest {
  zone_id: Zone["id"];
}

export interface SubZoneControlRequest {
  zone_id: Zone["id"];
  element_id: SubZone["element_id"];
  action: LightAction;
  intensity: number;
  animation_duration_ms: number;
}

export interface LightingControlRequest {
  lighting_id: Lighting["id"];
  action: LightAction;
}

export type CommandErrorCode =
  | "invalid_payload"
  | "not_found"
  | "hardware_offline"
  | "display_offline"
  | "timeout"
  | "busy"
  | "missed_deadline"
  | "unknown_element"
  | "hardware_error"
  | "display_error";

export interface CommandSuccess {
  status: "success";
  transaction_id: string;
}

export interface CommandError {
  status: "error";
  transaction_id: string;
  error_code: CommandErrorCode;
  message: string;
}

export type CommandResult = CommandSuccess | CommandError;

export interface ReadinessCheckPayload {
  transaction_id: string;
  requested_at_ms: number;
}

export interface ReadinessSuccess {
  transaction_id: string;
  status: "ready";
  checked_at_ms: number;
}

export interface ReadinessError {
  transaction_id: string;
  status: "error";
  error_code: CommandErrorCode;
  message: string;
  failed_at_ms: number;
}

export type ReadinessResult = ReadinessSuccess | ReadinessError;

export interface HardwareApplySuccess {
  transaction_id: string;
  status: "success";
  applied_at_ms: number;
}

export interface HardwareApplyError {
  transaction_id: string;
  status: "error";
  error_code:
    | "invalid_payload"
    | "unknown_element"
    | "busy"
    | "missed_deadline"
    | "hardware_error";
  message: string;
  failed_at_ms: number;
}

export type HardwareApplyResult = HardwareApplySuccess | HardwareApplyError;

export interface PrepareVideoPayload {
  transaction_id: string;
  zone_id: Zone["id"];
  video_url: string;
}

export type PrepareVideoResult =
  | {
      transaction_id: string;
      status: "ready";
      prepared_at_ms: number;
    }
  | {
      transaction_id: string;
      status: "error";
      error_code: "invalid_payload" | "display_error";
      message: string;
      failed_at_ms: number;
    };

export interface PlayVideoTransitionPayload {
  transaction_id: string;
  zone_id: Zone["id"];
  execute_at_ms: number;
  video_duration_ms: number;
  video_crossfade_duration_ms: number;
  loop: boolean;
}

export type DisplayPlaybackResult =
  | {
      transaction_id: string;
      status: "success";
      started_at_ms: number;
    }
  | {
      transaction_id: string;
      status: "error";
      error_code: "invalid_payload" | "missed_deadline" | "display_error";
      message: string;
      failed_at_ms: number;
    };

export interface StopVideoPayload {
  transaction_id: string;
}

export type StopVideoResult =
  | {
      transaction_id: string;
      status: "success";
      stopped_at_ms: number;
    }
  | {
      transaction_id: string;
      status: "error";
      error_code: "display_error";
      message: string;
      failed_at_ms: number;
    };

export interface PauseVideoPayload {
  transaction_id: string;
}

export type PauseVideoResult =
  | {
      transaction_id: string;
      status: "success";
      paused_at_ms: number;
    }
  | {
      transaction_id: string;
      status: "error";
      error_code: "display_error";
      message: string;
      failed_at_ms: number;
    };

export interface ResumeVideoPayload {
  transaction_id: string;
}

export type ResumeVideoResult =
  | {
      transaction_id: string;
      status: "success";
      resumed_at_ms: number;
    }
  | {
      transaction_id: string;
      status: "error";
      error_code: "display_error";
      message: string;
      failed_at_ms: number;
    };

export interface ServerHeartbeat {
  sent_at_ms: number;
}

export interface HardwareHeartbeat {
  pi_id: string;
  uptime_ms: number;
  status: "ready" | "error";
  active_transaction_id: string | null;
  active_zone_id: Zone["id"] | null;
  sent_at_ms: number;
}

export interface DisplayHeartbeat {
  display_id: string;
  uptime_ms: number;
  status: "ready" | "error";
  playback_state: "idle" | "preparing" | "playing" | "paused" | "error";
  active_zone_id: Zone["id"] | null;
  sent_at_ms: number;
}

export interface DeviceStatus {
  online: boolean;
}

export type RuntimeMode = "idle" | "area" | "zone" | "subzone" | "lighting";
export type RuntimePlaybackState = "idle" | "playing" | "paused";

export interface RuntimeStatus {
  mode: RuntimeMode;
  playback_state: RuntimePlaybackState;
  active_area_id: Area["id"] | null;
  active_zone_id: Zone["id"] | null;
  active_lighting_id: Lighting["id"] | null;
  active_element_id: SubZone["element_id"] | null;
}

export interface EmergencyShutdownPayload {
  signal: "emergency-halt";
}

export type EmergencyShutdownResult =
  | {
      pi_id: string;
      status: "safe";
      completed_at_ms: number;
    }
  | {
      pi_id: string;
      status: "error";
      error_code: "hardware_error";
      message: string;
      completed_at_ms: number;
    };

export type SocketAck<T> = (result: T) => void;

export interface TabletToServerEvents {
  "area-activation": (
    payload: AreaActivationRequest,
    ack: SocketAck<CommandResult>,
  ) => void;
  "zone-activation": (
    payload: ZoneActivationRequest,
    ack: SocketAck<CommandResult>,
  ) => void;
  "subzone-control": (
    payload: SubZoneControlRequest,
    ack: SocketAck<CommandResult>,
  ) => void;
  "lighting-control": (
    payload: LightingControlRequest,
    ack: SocketAck<CommandResult>,
  ) => void;
  "sequence-pause": (ack: SocketAck<CommandResult>) => void;
  "sequence-resume": (ack: SocketAck<CommandResult>) => void;
  "sequence-stop": (ack: SocketAck<CommandResult>) => void;
  "global-emergency-stop": () => void;
}

export interface ServerToTabletEvents {
  "system-layout": (payload: AppConfig) => void;
  "hardware-status": (payload: DeviceStatus) => void;
  "display-status": (payload: DeviceStatus) => void;
  "runtime-status": (payload: RuntimeStatus) => void;
}

export interface ServerToHardwareEvents {
  "hardware-readiness-check": (
    payload: ReadinessCheckPayload,
    ack: SocketAck<ReadinessResult>,
  ) => void;
  "hardware-apply-state": (
    payload: HardwareApplyStatePayload,
    ack: SocketAck<HardwareApplyResult>,
  ) => void;
  "server-heartbeat": (payload: ServerHeartbeat) => void;
  "hardware-emergency-shutdown": (payload: EmergencyShutdownPayload) => void;
}

export interface HardwareToServerEvents {
  "hardware-heartbeat": (payload: HardwareHeartbeat) => void;
  "emergency-shutdown-result": (payload: EmergencyShutdownResult) => void;
}

export interface ServerToDisplayEvents {
  "display-readiness-check": (
    payload: ReadinessCheckPayload,
    ack: SocketAck<ReadinessResult>,
  ) => void;
  "prepare-video": (
    payload: PrepareVideoPayload,
    ack: SocketAck<PrepareVideoResult>,
  ) => void;
  "play-video-transition": (
    payload: PlayVideoTransitionPayload,
    ack: SocketAck<DisplayPlaybackResult>,
  ) => void;
  "stop-video": (
    payload: StopVideoPayload,
    ack: SocketAck<StopVideoResult>,
  ) => void;
  "pause-video": (
    payload: PauseVideoPayload,
    ack: SocketAck<PauseVideoResult>,
  ) => void;
  "resume-video": (
    payload: ResumeVideoPayload,
    ack: SocketAck<ResumeVideoResult>,
  ) => void;
  "server-heartbeat": (payload: ServerHeartbeat) => void;
}

export interface DisplayToServerEvents {
  "display-heartbeat": (payload: DisplayHeartbeat) => void;
}

export interface ClientToServerEvents
  extends TabletToServerEvents, HardwareToServerEvents, DisplayToServerEvents {}

export interface ServerToClientEvents
  extends ServerToTabletEvents, ServerToHardwareEvents, ServerToDisplayEvents {}

export interface InterServerEvents {}
