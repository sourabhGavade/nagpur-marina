"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type PlaybackState = "idle" | "preparing" | "playing" | "paused" | "error";

interface PrepareVideoPayload {
  transaction_id: string;
  zone_id: string;
  video_url: string;
}

interface PlayVideoPayload {
  transaction_id: string;
  zone_id: string;
  execute_at_ms: number;
  video_duration_ms: number;
  video_crossfade_duration_ms: number;
  loop: boolean;
}

interface VideoControlPayload {
  transaction_id: string;
}

const socketUrl =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  (typeof window === "undefined"
    ? "http://localhost:4000"
    : `${window.location.protocol}//${window.location.hostname}:4000`);

export default function DisplayPage() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeIndexRef = useRef(0);
  const preparedIndexRef = useRef<number | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackStateRef = useRef<PlaybackState>("idle");
  const activeZoneRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    const videos: [HTMLVideoElement, HTMLVideoElement] = [videoA, videoB];
    startedAtRef.current = Date.now();

    const setRuntimeState = (
      state: PlaybackState,
      zoneId: string | null = activeZoneRef.current,
    ) => {
      playbackStateRef.current = state;
      activeZoneRef.current = zoneId;
      setPlaybackState(state);
      setActiveZone(zoneId);
    };

    const stopPlayback = () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }

      for (const video of videos) {
        video.pause();
        video.currentTime = 0;
        video.style.transition = "none";
        video.style.opacity = "0";
      }

      activeIndexRef.current = 0;
      preparedIndexRef.current = null;
      setRuntimeState("idle", null);
      setErrorMessage("");
    };

    const socket: Socket = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
      auth: {
        role: "display",
        client_id: `display-${window.location.hostname}`,
      },
      reconnection: true,
    });

    socket.on("connect", () => {
      setConnected(true);
      setErrorMessage("");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      stopPlayback();
    });

    socket.on("connect_error", (error) => {
      setConnected(false);
      setErrorMessage(error.message || "Unable to connect to server");
    });

    socket.on("display-readiness-check", (payload, ack) => {
      ack({
        transaction_id: payload.transaction_id,
        status: "ready",
        checked_at_ms: Date.now(),
      });
    });

    socket.on(
      "prepare-video",
      (payload: PrepareVideoPayload, ack: (result: unknown) => void) => {
        if (!payload.video_url || !payload.zone_id) {
          ack({
            transaction_id: payload.transaction_id,
            status: "error",
            error_code: "invalid_payload",
            message: "Missing video URL or Zone ID",
            failed_at_ms: Date.now(),
          });
          return;
        }

        const standbyIndex = activeIndexRef.current === 0 ? 1 : 0;
        const standby = videos[standbyIndex];
        const hasActivePlayback =
          playbackStateRef.current === "playing" ||
          playbackStateRef.current === "paused";
        if (!hasActivePlayback) setRuntimeState("preparing");
        setErrorMessage("");

        let settled = false;
        const finish = (result: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          standby.removeEventListener("canplay", onReady);
          standby.removeEventListener("error", onError);
          ack(result);
        };
        const onReady = () => {
          preparedIndexRef.current = standbyIndex;
          finish({
            transaction_id: payload.transaction_id,
            status: "ready",
            prepared_at_ms: Date.now(),
          });
        };
        const onError = () => {
          const message = `Unable to load ${payload.video_url}`;
          setRuntimeState("error");
          setErrorMessage(message);
          finish({
            transaction_id: payload.transaction_id,
            status: "error",
            error_code: "display_error",
            message,
            failed_at_ms: Date.now(),
          });
        };
        const timeout = window.setTimeout(onError, 15_000);

        standby.pause();
        standby.style.transition = "none";
        standby.style.opacity = "0";
        standby.addEventListener("canplay", onReady, { once: true });
        standby.addEventListener("error", onError, { once: true });
        standby.src = payload.video_url;
        standby.load();
      },
    );

    socket.on(
      "play-video-transition",
      (payload: PlayVideoPayload, ack: (result: unknown) => void) => {
        const nextIndex = preparedIndexRef.current;
        if (nextIndex === null) {
          ack({
            transaction_id: payload.transaction_id,
            status: "error",
            error_code: "display_error",
            message: "No prepared video is available",
            failed_at_ms: Date.now(),
          });
          return;
        }

        const delay = payload.execute_at_ms - Date.now();
        if (delay < -250) {
          ack({
            transaction_id: payload.transaction_id,
            status: "error",
            error_code: "missed_deadline",
            message: "Playback deadline was missed",
            failed_at_ms: Date.now(),
          });
          return;
        }

        if (playTimerRef.current) clearTimeout(playTimerRef.current);
        playTimerRef.current = setTimeout(
          async () => {
            const previous = videos[activeIndexRef.current];
            const next = videos[nextIndex];

            try {
              next.currentTime = 0;
              next.loop = payload.loop;
              await next.play();

              const duration = payload.video_crossfade_duration_ms;
              next.style.transition = `opacity ${duration}ms linear`;
              previous.style.transition = `opacity ${duration}ms linear`;
              next.style.opacity = "1";
              previous.style.opacity = "0";

              window.setTimeout(() => {
                previous.pause();
                previous.currentTime = 0;
              }, duration);

              activeIndexRef.current = nextIndex;
              preparedIndexRef.current = null;
              setRuntimeState("playing", payload.zone_id);
              ack({
                transaction_id: payload.transaction_id,
                status: "success",
                started_at_ms: Date.now(),
              });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Playback failed";
              setRuntimeState("error");
              setErrorMessage(message);
              ack({
                transaction_id: payload.transaction_id,
                status: "error",
                error_code: "display_error",
                message,
                failed_at_ms: Date.now(),
              });
            }
          },
          Math.max(0, delay),
        );
      },
    );

    socket.on(
      "pause-video",
      (payload: VideoControlPayload, ack: (result: unknown) => void) => {
        if (playbackStateRef.current !== "playing") {
          ack({
            transaction_id: payload.transaction_id,
            status: "error",
            error_code: "display_error",
            message: "No playing video is available to pause",
            failed_at_ms: Date.now(),
          });
          return;
        }

        videos[activeIndexRef.current].pause();
        setRuntimeState("paused");
        ack({
          transaction_id: payload.transaction_id,
          status: "success",
          paused_at_ms: Date.now(),
        });
      },
    );

    socket.on(
      "resume-video",
      async (payload: VideoControlPayload, ack: (result: unknown) => void) => {
        if (playbackStateRef.current !== "paused") {
          ack({
            transaction_id: payload.transaction_id,
            status: "error",
            error_code: "display_error",
            message: "No paused video is available to resume",
            failed_at_ms: Date.now(),
          });
          return;
        }

        try {
          await videos[activeIndexRef.current].play();
          setRuntimeState("playing");
          ack({
            transaction_id: payload.transaction_id,
            status: "success",
            resumed_at_ms: Date.now(),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Resume failed";
          setRuntimeState("error");
          setErrorMessage(message);
          ack({
            transaction_id: payload.transaction_id,
            status: "error",
            error_code: "display_error",
            message,
            failed_at_ms: Date.now(),
          });
        }
      },
    );

    socket.on(
      "stop-video",
      (payload: VideoControlPayload, ack: (result: unknown) => void) => {
        stopPlayback();
        ack({
          transaction_id: payload.transaction_id,
          status: "success",
          stopped_at_ms: Date.now(),
        });
      },
    );

    const sendHeartbeat = () => {
      if (!socket.connected) return;
      socket.emit("display-heartbeat", {
        display_id: `display-${window.location.hostname}`,
        uptime_ms: Date.now() - startedAtRef.current,
        status: playbackStateRef.current === "error" ? "error" : "ready",
        playback_state: playbackStateRef.current,
        active_zone_id: activeZoneRef.current,
        sent_at_ms: Date.now(),
      });
    };
    const heartbeat = window.setInterval(sendHeartbeat, 5_000);

    socket.connect();
    socket.on("connect", sendHeartbeat);

    return () => {
      window.clearInterval(heartbeat);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      socket.disconnect();
    };
  }, []);

  return (
    <main className="display-shell">
      <video
        ref={videoARef}
        className="display-video"
        muted
        playsInline
        preload="auto"
      />
      <video
        ref={videoBRef}
        className="display-video"
        muted
        playsInline
        preload="auto"
      />

      <div className="display-status">
        <span className={`display-dot ${connected ? "online" : ""}`} />
        <div>
          <strong>
            {!connected
              ? "Connecting to experience"
              : playbackState === "preparing"
                ? "Preparing media"
                : playbackState === "playing"
                  ? "Playback playing"
                  : playbackState === "paused"
                    ? "Playback paused"
                    : playbackState === "error"
                      ? "Display error"
                      : "Display ready"}
          </strong>
          <small>
            {errorMessage ||
              (activeZone ? `Playing ${activeZone}` : "Waiting for a command")}
          </small>
        </div>
      </div>
    </main>
  );
}
