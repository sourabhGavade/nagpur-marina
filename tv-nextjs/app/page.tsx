"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { socketUrl, idleVideoUrl } from "@/lib/consts";
import type {
  PlaybackState,
  PrepareVideoPayload,
  PlayVideoPayload,
  VideoControlPayload,
} from "@/lib/types";

export default function DisplayPage() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeIndexRef = useRef(0);
  const preparedIndexRef = useRef<number | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackStateRef = useRef<PlaybackState>("idle");
  const activeZoneRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const idleRequestRef = useRef(0);
  const audioUnlockedRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    const videos: [HTMLVideoElement, HTMLVideoElement] = [videoA, videoB];
    startedAtRef.current = Date.now();

    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);

      const active = videos[activeIndexRef.current];
      if (
        (playbackStateRef.current === "playing" ||
          playbackStateRef.current === "idle") &&
        active &&
        !active.paused
      ) {
        active.muted = false;
        active.volume = 1;
      }
    };

    const onGesture = () => {
      unlockAudio();
    };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });

    const setRuntimeState = (
      state: PlaybackState,
      zoneId: string | null = activeZoneRef.current,
    ) => {
      playbackStateRef.current = state;
      activeZoneRef.current = zoneId;
      setPlaybackState(state);
    };

    const playIdleVideo = () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }

      const previousIndex = activeIndexRef.current;
      const previous = videos[previousIndex];
      const alreadyIdle =
        playbackStateRef.current === "idle" &&
        previous.loop &&
        !previous.paused &&
        previous.currentSrc.includes(idleVideoUrl);

      if (alreadyIdle) {
        preparedIndexRef.current = null;
        setRuntimeState("idle", null);
        setErrorMessage("");
        return;
      }

      const requestId = ++idleRequestRef.current;
      const hasVisibleContent =
        previous.style.opacity !== "0" && Boolean(previous.currentSrc);
      const idleIndex = hasVisibleContent ? (previousIndex === 0 ? 1 : 0) : 0;
      const idle = videos[idleIndex];

      idle.pause();
      idle.loop = true;
      idle.muted = true;
      idle.style.transition = "none";
      if (idle !== previous) {
        idle.style.opacity = "0";
      }

      const finishIdle = async () => {
        if (requestId !== idleRequestRef.current) return;
        try {
          idle.currentTime = 0;
          idle.volume = 1;
          // Browsers block unmuted play() until the user interacts once.
          idle.muted = !audioUnlockedRef.current;
          await idle.play();
          if (audioUnlockedRef.current) {
            idle.muted = false;
          }
          if (requestId !== idleRequestRef.current) return;

          idle.style.opacity = "1";
          if (previous !== idle) {
            previous.style.transition = "none";
            previous.style.opacity = "0";
            previous.muted = true;
            previous.pause();
            previous.currentTime = 0;
          }

          activeIndexRef.current = idleIndex;
          preparedIndexRef.current = null;
          setRuntimeState("idle", null);
          setErrorMessage("");
        } catch (error) {
          if (requestId !== idleRequestRef.current) return;
          const message =
            error instanceof Error ? error.message : "Idle video failed";
          setRuntimeState("error");
          setErrorMessage(message);
        }
      };

      const onReady = () => {
        idle.removeEventListener("error", onError);
        void finishIdle();
      };
      const onError = () => {
        idle.removeEventListener("canplay", onReady);
        if (requestId !== idleRequestRef.current) return;
        setRuntimeState("error");
        setErrorMessage(`Unable to load idle video ${idleVideoUrl}`);
      };

      idle.addEventListener("canplay", onReady, { once: true });
      idle.addEventListener("error", onError, { once: true });
      idle.src = idleVideoUrl;
      idle.load();
    };

    const stopPlayback = () => {
      playIdleVideo();
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

        idleRequestRef.current += 1;
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
              next.volume = 1;
              // Browsers block unmuted play() until the user interacts once.
              next.muted = !audioUnlockedRef.current;
              await next.play();
              if (audioUnlockedRef.current) {
                next.muted = false;
              }

              const duration = payload.video_crossfade_duration_ms;
              next.style.transition = `opacity ${duration}ms linear`;
              previous.style.transition = `opacity ${duration}ms linear`;
              previous.muted = true;
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
          const active = videos[activeIndexRef.current];
          active.volume = 1;
          active.muted = !audioUnlockedRef.current;
          await active.play();
          if (audioUnlockedRef.current) {
            active.muted = false;
          }
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

    playIdleVideo();
    socket.connect();
    socket.on("connect", sendHeartbeat);

    return () => {
      idleRequestRef.current += 1;
      window.clearInterval(heartbeat);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
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

      {!audioUnlocked && (
        <button type="button" className="display-audio-unlock">
          Click to enable sound
        </button>
      )}

      <div
        className={`display-status${
          playbackState === "playing" || playbackState === "paused"
            ? " hidden"
            : ""
        }`}
      >
        <span className={`display-dot ${connected ? "online" : ""}`} />
        <div>
          <strong>
            {!connected
              ? "Connecting to experience"
              : playbackState === "preparing"
                ? "Preparing media"
                : playbackState === "error"
                  ? "Display error"
                  : "Display ready"}
          </strong>
          <small>{errorMessage || "Idle loop playing"}</small>
        </div>
      </div>
    </main>
  );
}
