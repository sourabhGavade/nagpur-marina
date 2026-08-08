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
import { v4 } from "uuid";
import type {
  AppConfig,
  Area,
  Zone,
  Lighting,
  ConnectionState,
  RuntimeStatus,
  TabletContextValue,
  CommandResult,
} from "@/lib/types";
import { socketUrl } from "@/lib/consts";

const TabletContext = createContext<TabletContextValue | null>(null);

export function TabletContextProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<AppConfig | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [hardwareOnline, setHardwareOnline] = useState<boolean | null>(null);
  const [displayOnline, setDisplayOnline] = useState<boolean | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    mode: "idle",
    playback_state: "idle",
    muted: false,
    active_area_id: null,
    active_zone_id: null,
    active_lighting_id: null,
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
      muted: false,
      active_area_id: null,
      active_zone_id: null,
      active_lighting_id: null,
      active_element_id: null,
    });
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected || connectionState === "connecting") {
      return;
    }

    socketRef.current?.disconnect();
    setConnectionState("connecting");
    setErrorMessage("");

    const socket = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
      auth: {
        role: "tablet",
        client_id: `tablet-${v4()}`,
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
        muted: false,
        active_area_id: null,
        active_zone_id: null,
        active_lighting_id: null,
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
        | "lighting-control"
        | "sequence-pause"
        | "sequence-resume"
        | "sequence-mute"
        | "sequence-unmute"
        | "sequence-stop",
      payload?:
        | { area_id: Area["id"] }
        | { zone_id: Zone["id"] }
        | {
            lighting_id: Lighting["id"];
            action: "activate" | "deactivate";
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
          event === "lighting-control" &&
          payload &&
          "lighting_id" in payload
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

        if (event === "sequence-mute") {
          socket.emit("sequence-mute", resolve);
          return;
        }

        if (event === "sequence-unmute") {
          socket.emit("sequence-unmute", resolve);
          return;
        }

        socket.emit("sequence-stop", resolve);
      }),
    [],
  );

  const activateArea = useCallback(
    (areaId: Area["id"]) => emitCommand("area-activation", { area_id: areaId }),
    [emitCommand],
  );

  const activateZone = useCallback(
    (zoneId: Zone["id"]) => emitCommand("zone-activation", { zone_id: zoneId }),
    [emitCommand],
  );

  const controlLighting = useCallback(
    (lightingId: Lighting["id"], action: "activate" | "deactivate") =>
      emitCommand("lighting-control", {
        lighting_id: lightingId,
        action,
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

  const muteSequence = useCallback(
    () => emitCommand("sequence-mute"),
    [emitCommand],
  );

  const unmuteSequence = useCallback(
    () => emitCommand("sequence-unmute"),
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
        controlLighting,
        pauseSequence,
        resumeSequence,
        muteSequence,
        unmuteSequence,
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
