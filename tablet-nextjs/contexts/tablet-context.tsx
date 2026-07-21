"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";

export interface SubZone {
  element_id: string;
  color_hex: `#${string}`;
  intensity_percent: number;
  animation_duration_ms: number;
  tabletImageUrl: string;
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
  tabletImageUrl: string;
  zones: Zone[];
}

export interface AppConfig {
  areas: Area[];
}

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export type CommandResult =
  | { status: "success"; transaction_id: string }
  | {
      status: "error";
      transaction_id: string;
      error_code: string;
      message: string;
    };

export interface RuntimeStatus {
  mode: "idle" | "area" | "zone" | "subzone";
  playback_state: "idle" | "playing" | "paused";
  active_area_id: number | null;
  active_zone_id: string | null;
  active_element_id: string | null;
}

interface TabletContextValue {
  layout: AppConfig | null;
  connectionState: ConnectionState;
  hardwareOnline: boolean | null;
  displayOnline: boolean | null;
  runtimeStatus: RuntimeStatus;
  errorMessage: string;
  connect: () => void;
  disconnect: () => void;
  activateArea: (areaId: Area["id"]) => Promise<CommandResult>;
  activateZone: (zoneId: Zone["id"]) => Promise<CommandResult>;
  controlSubZone: (
    zoneId: Zone["id"],
    subZone: SubZone,
    action?: "activate" | "deactivate",
  ) => Promise<CommandResult>;
  pauseSequence: () => Promise<CommandResult>;
  resumeSequence: () => Promise<CommandResult>;
  stopSequence: () => Promise<CommandResult>;
}

const TabletContext = createContext<TabletContextValue | null>(null);

function getSocketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export function TabletContextProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<AppConfig | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [hardwareOnline, setHardwareOnline] = useState<boolean | null>(null);
  const [displayOnline, setDisplayOnline] = useState<boolean | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    mode: "idle",
    playback_state: "idle",
    active_area_id: null,
    active_zone_id: null,
    active_element_id: null,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const socketRef = useRef<Socket | null>(null);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnectionState("idle");
    setHardwareOnline(null);
    setDisplayOnline(null);
    setRuntimeStatus({
      mode: "idle",
      playback_state: "idle",
      active_area_id: null,
      active_zone_id: null,
      active_element_id: null,
    });
  }, []);

  const connect = useCallback(() => {
    if (
      socketRef.current?.connected ||
      connectionState === "connecting"
    ) {
      return;
    }

    socketRef.current?.disconnect();
    setConnectionState("connecting");
    setErrorMessage("");

    const socket = io(getSocketUrl(), {
      autoConnect: false,
      transports: ["websocket"],
      auth: {
        role: "tablet",
        client_id: `tablet-${crypto.randomUUID()}`,
      },
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnectionState("connected"));
    socket.on("disconnect", () => {
      setConnectionState("idle");
      setHardwareOnline(null);
      setDisplayOnline(null);
      setRuntimeStatus({
        mode: "idle",
        playback_state: "idle",
        active_area_id: null,
        active_zone_id: null,
        active_element_id: null,
      });
    });
    socket.on("connect_error", (error) => {
      setErrorMessage(error.message || "Unable to reach the server");
      setConnectionState("error");
    });
    socket.on("system-layout", (data: AppConfig) => {
      setLayout(data);
    });
    socket.on("hardware-status", ({ online }: { online: boolean }) => {
      setHardwareOnline(online);
    });
    socket.on("display-status", ({ online }: { online: boolean }) => {
      setDisplayOnline(online);
    });
    socket.on("runtime-status", (status: RuntimeStatus) => {
      setRuntimeStatus(status);
    });

    socket.connect();
  }, [connectionState]);

  const emitCommand = useCallback(
    (
      event:
        | "area-activation"
        | "zone-activation"
        | "subzone-control"
        | "sequence-pause"
        | "sequence-resume"
        | "sequence-stop",
      payload?:
        | { area_id: Area["id"] }
        | { zone_id: Zone["id"] }
        | {
            zone_id: Zone["id"];
            element_id: SubZone["element_id"];
            action: "activate" | "deactivate";
            color_hex: SubZone["color_hex"];
            intensity_percent: number;
            animation_duration_ms: number;
          },
    ) =>
      new Promise<CommandResult>((resolve) => {
        const socket = socketRef.current;

        if (!socket?.connected) {
          resolve({
            status: "error",
            transaction_id: "client",
            error_code: "not_connected",
            message: "Tablet is not connected to the server",
          });
          return;
        }

        if (event === "area-activation" && payload && "area_id" in payload) {
          socket.emit(event, payload, resolve);
          return;
        }

        if (event === "zone-activation" && payload && "zone_id" in payload) {
          socket.emit(event, payload, resolve);
          return;
        }

        if (
          event === "subzone-control" &&
          payload &&
          "element_id" in payload
        ) {
          socket.emit(event, payload, resolve);
          return;
        }

        if (event === "sequence-pause") {
          socket.emit("sequence-pause", resolve);
          return;
        }

        if (event === "sequence-resume") {
          socket.emit("sequence-resume", resolve);
          return;
        }

        socket.emit("sequence-stop", resolve);
      }),
    [],
  );

  const activateArea = useCallback(
    (areaId: Area["id"]) =>
      emitCommand("area-activation", { area_id: areaId }),
    [emitCommand],
  );

  const activateZone = useCallback(
    (zoneId: Zone["id"]) =>
      emitCommand("zone-activation", { zone_id: zoneId }),
    [emitCommand],
  );

  const controlSubZone = useCallback(
    (
      zoneId: Zone["id"],
      subZone: SubZone,
      action: "activate" | "deactivate" = "activate",
    ) =>
      emitCommand("subzone-control", {
        zone_id: zoneId,
        element_id: subZone.element_id,
        action,
        color_hex: subZone.color_hex,
        intensity_percent: subZone.intensity_percent,
        animation_duration_ms: subZone.animation_duration_ms,
      }),
    [emitCommand],
  );

  const stopSequence = useCallback(
    () => emitCommand("sequence-stop"),
    [emitCommand],
  );

  const pauseSequence = useCallback(
    () => emitCommand("sequence-pause"),
    [emitCommand],
  );

  const resumeSequence = useCallback(
    () => emitCommand("sequence-resume"),
    [emitCommand],
  );

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <TabletContext.Provider
      value={{
        layout,
        connectionState,
        hardwareOnline,
        displayOnline,
        runtimeStatus,
        errorMessage,
        connect,
        disconnect,
        activateArea,
        activateZone,
        controlSubZone,
        pauseSequence,
        resumeSequence,
        stopSequence,
      }}
    >
      {children}
    </TabletContext.Provider>
  );
}

export function useTabletContext() {
  const context = useContext(TabletContext);

  if (!context) {
    throw new Error("useTabletContext must be used inside TabletProvider");
  }

  return context;
}
