"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeviceStatuses } from "../../components/device-statuses";
import { PlaybackControls } from "../../components/playback-controls";
import { useTabletContext } from "../../contexts/tablet-context";

type ActionState = "idle" | "starting" | "playing" | "stopping" | "error";

export default function AreasPage() {
  const {
    layout,
    connectionState,
    runtimeStatus,
    activateArea,
    activateZone,
    pauseSequence,
    resumeSequence,
  } = useTabletContext();
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    if (!layout || connectionState !== "connected") {
      router.replace("/");
    }
  }, [connectionState, layout, router]);

  if (!layout) {
    return (
      <main className="journey-shell journey-loading">
        <span className="spinner" aria-hidden="true" />
        <p>Loading areas…</p>
      </main>
    );
  }

  const activeArea =
    runtimeStatus.playback_state !== "idle"
      ? layout.areas.find((area) => area.id === runtimeStatus.active_area_id)
      : undefined;
  const selectedArea =
    activeArea ??
    layout.areas.find((area) => area.id === selectedAreaId) ??
    layout.areas[0];
  const stageZone =
    selectedArea?.zones.find(
      (zone) => zone.id === runtimeStatus.active_zone_id,
    ) ?? selectedArea?.zones[0];

  async function controlArea(areaId: number) {
    const isCurrentArea =
      runtimeStatus.mode === "area" && runtimeStatus.active_area_id === areaId;

    setSelectedAreaId(areaId);
    setActionState("starting");
    setStatusMessage(
      isCurrentArea && runtimeStatus.playback_state === "playing"
        ? "Pausing area sequence…"
        : isCurrentArea && runtimeStatus.playback_state === "paused"
          ? "Resuming area sequence…"
          : "Starting area sequence…",
    );

    const result =
      isCurrentArea && runtimeStatus.playback_state === "playing"
        ? await pauseSequence()
        : isCurrentArea && runtimeStatus.playback_state === "paused"
          ? await resumeSequence()
          : await activateArea(areaId);

    if (result.status === "success") {
      setActionState("playing");
      setStatusMessage(
        isCurrentArea && runtimeStatus.playback_state === "playing"
          ? "Area sequence paused"
          : "Area sequence is playing",
      );
    } else {
      setActionState("error");
      setStatusMessage("");
      toast.error("Unable to control area", {
        description: result.message,
      });
    }
  }

  async function controlZone(zoneId: string) {
    const isCurrentZone = runtimeStatus.active_zone_id === zoneId;

    setActionState("starting");
    setStatusMessage(
      isCurrentZone && runtimeStatus.playback_state === "playing"
        ? "Pausing zone…"
        : isCurrentZone && runtimeStatus.playback_state === "paused"
          ? "Resuming zone…"
          : "Starting zone…",
    );

    const result =
      isCurrentZone && runtimeStatus.playback_state === "playing"
        ? await pauseSequence()
        : isCurrentZone && runtimeStatus.playback_state === "paused"
          ? await resumeSequence()
          : await activateZone(zoneId);

    if (result.status === "success") {
      setActionState("playing");
      setStatusMessage(
        isCurrentZone && runtimeStatus.playback_state === "playing"
          ? "Zone paused"
          : "Zone is playing",
      );
    } else {
      setActionState("error");
      setStatusMessage("");
      toast.error("Unable to control zone", {
        description: result.message,
      });
    }
  }

  return (
    <main className="areas-shell">
      <header className="areas-header">
        <div className="areas-menu-button">
          <span>Areas</span>
        </div>

        <button
          type="button"
          className="areas-home"
          onClick={() => router.push("/journey")}
        >
          Main menu
        </button>

        <DeviceStatuses />
      </header>

      <motion.aside
        id="areas-menu"
        className="areas-drawer"
        initial={{ opacity: 0, x: reduceMotion ? 0 : -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: reduceMotion ? 0.1 : 0.35,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="areas-drawer-heading">
          <span>Experience areas</span>
          <small>{layout.areas.length} available</small>
        </div>

        <div className="areas-list">
          {layout.areas.map((area, index) => {
            const isCurrentArea =
              runtimeStatus.mode === "area" &&
              runtimeStatus.active_area_id === area.id;
            const isPlaying =
              isCurrentArea && runtimeStatus.playback_state === "playing";

            return (
              <section
                className={`area-list-item${
                  selectedArea?.id === area.id ? " active" : ""
                }${isCurrentArea ? " playing" : ""}`}
                key={area.id}
              >
                <div className="area-list-title">
                  <button
                    type="button"
                    onClick={() => setSelectedAreaId(area.id)}
                  >
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <strong>{area.name}</strong>
                  </button>
                  <button
                    type="button"
                    className={`area-play-button${
                      isCurrentArea ? " current" : ""
                    }`}
                    onClick={() => controlArea(area.id)}
                    disabled={
                      actionState === "starting" || actionState === "stopping"
                    }
                    aria-label={`${isPlaying ? "Pause" : "Play"} ${area.name}`}
                  >
                    {isPlaying ? (
                      <i className="pause-icon" aria-hidden="true" />
                    ) : (
                      "▶"
                    )}
                  </button>
                </div>

                <ul>
                  {area.zones.map((zone) => {
                    const isCurrentZone =
                      runtimeStatus.active_zone_id === zone.id;
                    const isPlaying =
                      isCurrentZone &&
                      runtimeStatus.playback_state === "playing";

                    return (
                      <li
                        className={isCurrentZone ? "playing" : undefined}
                        key={zone.id}
                      >
                        <span>{zone.name}</span>
                        <button
                          type="button"
                          className={`zone-inline-control${
                            isCurrentZone ? " current" : ""
                          }`}
                          onClick={() => controlZone(zone.id)}
                          disabled={actionState === "starting"}
                          aria-label={`${isPlaying ? "Pause" : "Play"} ${
                            zone.name
                          }`}
                        >
                          {isPlaying ? (
                            <i className="pause-icon" aria-hidden="true" />
                          ) : (
                            "▶"
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </motion.aside>

      <section className="area-stage" aria-live="polite">
        {selectedArea ? (
          <>
            <div className="area-image-fallback" aria-hidden="true" />
            {stageZone ? (
              <Image
                key={stageZone.id}
                src={stageZone.tabletImageUrl}
                alt={stageZone.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 84vw"
                className="area-image"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : null}
          </>
        ) : (
          <div className="empty-areas">No areas are available.</div>
        )}

        <PlaybackControls
          onPlay={() =>
            selectedArea ? controlArea(selectedArea.id) : Promise.resolve()
          }
          busy={actionState === "starting"}
          statusMessage={statusMessage}
          showPrimary={false}
        />
      </section>
    </main>
  );
}
