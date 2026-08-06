"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeviceStatuses } from "@/components/device-statuses";
import { MarinaLoading } from "@/components/marina-loading";
import { PlaybackControls } from "@/components/playback-controls";
import { useTabletContext } from "@/contexts/tablet-context";
import { useGoHome } from "@/hooks/use-go-home";
import type { ActionState } from "@/lib/types";

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
  const goHome = useGoHome();

  useEffect(() => {
    if (!layout || connectionState !== "connected") {
      router.replace("/");
    }
  }, [connectionState, layout, router]);

  if (!layout) {
    return <MarinaLoading label="Loading areas…" />;
  }

  const activeArea = layout.areas.find(
    (area) => area.id === runtimeStatus.active_area_id,
  );
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

  function zoneStatus(areaId: number, zoneId: string, zoneIndex: number) {
    const isCurrentZone = runtimeStatus.active_zone_id === zoneId;
    if (isCurrentZone && runtimeStatus.playback_state === "playing") {
      return "Playing";
    }
    if (isCurrentZone && runtimeStatus.playback_state === "paused") {
      return "Paused";
    }

    const isAreaPlaying =
      runtimeStatus.mode === "area" &&
      runtimeStatus.active_area_id === areaId &&
      runtimeStatus.playback_state !== "idle";

    if (isAreaPlaying) {
      const activeIndex = layout?.areas
        .find((area) => area.id === areaId)
        ?.zones.findIndex((zone) => zone.id === runtimeStatus.active_zone_id);
      if (
        activeIndex !== undefined &&
        activeIndex >= 0 &&
        zoneIndex === activeIndex + 1
      ) {
        return "Up Next";
      }
    }

    return null;
  }

  return (
    <main className="marina-experience marina-shell">
      <div className="marina-experience-bg" aria-hidden="true">
        <Image
          src="/assets/main_bg.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="marina-experience-shade" />
      </div>

      <motion.div
        className="marina-frame"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0.15 : 0.55,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <header className="marina-frame-header">
          <button
            type="button"
            className="marina-logo-button"
            onClick={() => void goHome()}
            aria-label="Back to main menu"
          >
            <Image
              src="/assets/main_logo.png"
              alt="Nagpur Marina"
              width={240}
              height={80}
              priority
              className="marina-logo"
            />
          </button>
          <DeviceStatuses />
        </header>

        <div className="marina-frame-body">
          <aside className="marina-chapters">
            <h2>Chapters</h2>

            <div className="marina-chapters-list">
              {layout.areas.map((area) => {
                const isCurrentArea =
                  runtimeStatus.active_area_id === area.id;
                const isPlaying =
                  isCurrentArea &&
                  runtimeStatus.mode === "area" &&
                  runtimeStatus.playback_state === "playing";

                return (
                  <section
                    key={area.id}
                    className={`marina-chapter${
                      selectedArea?.id === area.id ? " is-selected" : ""
                    }${isCurrentArea ? " is-active" : ""}`}
                  >
                    <div className="marina-chapter-title">
                      <button
                        type="button"
                        onClick={() => setSelectedAreaId(area.id)}
                      >
                        {area.name}
                      </button>
                      <button
                        type="button"
                        className={`marina-play-button${
                          isCurrentArea ? " is-current" : ""
                        }`}
                        onClick={() => controlArea(area.id)}
                        disabled={
                          actionState === "starting" ||
                          actionState === "stopping"
                        }
                        aria-label={`${isPlaying ? "Pause" : "Play"} ${area.name}`}
                      >
                        {isPlaying ? (
                          <i className="pause-icon" aria-hidden="true" />
                        ) : (
                          <i className="play-icon" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <ul>
                      {area.zones.map((zone, zoneIndex) => {
                        const status = zoneStatus(area.id, zone.id, zoneIndex);
                        const isCurrentZone =
                          runtimeStatus.active_zone_id === zone.id;
                        const areaSequenceActive =
                          runtimeStatus.mode === "area";

                        return (
                          <li
                            key={zone.id}
                            className={
                              isCurrentZone
                                ? "is-playing"
                                : status === "Up Next"
                                  ? "is-next"
                                  : undefined
                            }
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAreaId(area.id);
                                if (!areaSequenceActive) {
                                  void controlZone(zone.id);
                                }
                              }}
                              disabled={
                                actionState === "starting" || areaSequenceActive
                              }
                            >
                              <span>{zone.name}</span>
                              {status ? <small>{status}</small> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </aside>

          <section className="marina-stage" aria-live="polite">
            {selectedArea ? (
              <>
                <div className="marina-stage-fallback" aria-hidden="true" />
                {stageZone ? (
                  <Image
                    key={stageZone.id}
                    src={stageZone.tabletImageUrl}
                    alt={stageZone.name}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 66vw"
                    className="marina-stage-image"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </>
            ) : (
              <div className="marina-stage-empty">No areas are available.</div>
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
        </div>
      </motion.div>
    </main>
  );
}
