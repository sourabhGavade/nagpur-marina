"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTabletContext } from "../contexts/tablet-context";

interface PlaybackControlsProps {
  onPlay: () => Promise<void>;
  busy?: boolean;
  statusMessage?: string;
  showPrimary?: boolean;
}

export function PlaybackControls({
  onPlay,
  busy = false,
  statusMessage = "",
  showPrimary = true,
}: PlaybackControlsProps) {
  const {
    runtimeStatus,
    pauseSequence,
    resumeSequence,
    stopSequence,
  } = useTabletContext();
  const [commandPending, setCommandPending] = useState(false);

  const playbackState = runtimeStatus.playback_state;
  const disabled = busy || commandPending;
  const displayedStatus = busy
    ? statusMessage
    : playbackState === "playing"
      ? "Playback is running"
      : playbackState === "paused"
        ? "Playback is paused"
        : "Ready to play";

  async function runCommand(
    command: () => Promise<{
      status: "success" | "error";
      message?: string;
    }>,
    errorTitle: string,
  ) {
    setCommandPending(true);
    const result = await command();
    setCommandPending(false);

    if (result.status === "error") {
      toast.error(errorTitle, { description: result.message });
    }
  }

  async function handlePrimaryAction() {
    if (playbackState === "playing") {
      await runCommand(pauseSequence, "Unable to pause playback");
      return;
    }

    if (playbackState === "paused") {
      await runCommand(resumeSequence, "Unable to resume playback");
      return;
    }

    setCommandPending(true);
    await onPlay();
    setCommandPending(false);
  }

  async function handleStop() {
    await runCommand(stopSequence, "Unable to stop sequence");
  }

  return (
    <div className="area-stage-actions">
      <span className="area-status">{displayedStatus}</span>
      {showPrimary && (
        <button
          type="button"
          className="playback-button"
          onClick={handlePrimaryAction}
          disabled={disabled}
        >
          <i
            className={
              playbackState === "playing" ? "pause-icon" : "play-icon"
            }
            aria-hidden="true"
          />
          {commandPending
            ? "Working"
            : playbackState === "playing"
              ? "Pause"
              : playbackState === "paused"
                ? "Resume"
                : "Play"}
        </button>
      )}
      <button
        type="button"
        className="stop-button"
        onClick={handleStop}
        disabled={disabled || playbackState === "idle"}
      >
        <i aria-hidden="true" />
        Stop
      </button>
    </div>
  );
}
