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

export default function ZonesPage() {
  const {
    layout,
    connectionState,
    runtimeStatus,
    activateZone,
    pauseSequence,
    resumeSequence,
  } = useTabletContext();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
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
        <p>Loading zones…</p>
      </main>
    );
  }

  const zoneEntries = layout.areas.flatMap((area) =>
    area.zones.map((zone) => ({ area, zone })),
  );
  const activeEntry =
    runtimeStatus.playback_state !== "idle"
      ? zoneEntries.find(
          ({ zone }) => zone.id === runtimeStatus.active_zone_id,
        )
      : undefined;
  const selectedEntry =
    activeEntry ??
    zoneEntries.find(({ zone }) => zone.id === selectedZoneId) ??
    zoneEntries[0];

  async function controlZone(zoneId: string) {
    const isCurrentZone = runtimeStatus.active_zone_id === zoneId;

    setSelectedZoneId(zoneId);
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
          <span>Zones</span>
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
        className="areas-drawer"
        initial={{ opacity: 0, x: reduceMotion ? 0 : -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: reduceMotion ? 0.1 : 0.35,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        <div className="areas-drawer-heading">
          <span>Experience zones</span>
          <small>{zoneEntries.length} available</small>
        </div>

        <div className="areas-list">
          {layout.areas.map((area, areaIndex) => {
            const isActiveArea =
              runtimeStatus.active_area_id === area.id &&
              runtimeStatus.playback_state !== "idle";

            return (
              <section
                className={`area-list-item${
                  isActiveArea ? " playing" : ""
                }`}
                key={area.id}
              >
                <div className="zone-group-title">
                  <small>{String(areaIndex + 1).padStart(2, "0")}</small>
                  <strong>{area.name}</strong>
                </div>

                <div className="zone-menu-items">
                  {area.zones.map((zone) => {
                    const isCurrentZone =
                      runtimeStatus.active_zone_id === zone.id;
                    const isPlaying =
                      isCurrentZone &&
                      runtimeStatus.playback_state === "playing";

                    return (
                      <div
                        className={`zone-menu-row${
                          selectedEntry?.zone.id === zone.id ? " active" : ""
                        }${isCurrentZone ? " playing" : ""}`}
                        key={zone.id}
                      >
                        <button
                          type="button"
                          className="zone-select-button"
                          onClick={() => setSelectedZoneId(zone.id)}
                        >
                          <span>{zone.name}</span>
                          <small>
                            {zone.subZones.length}{" "}
                            {zone.subZones.length === 1
                              ? "sub-zone"
                              : "sub-zones"}
                          </small>
                        </button>
                        <button
                          type="button"
                          className={`area-play-button${
                            isCurrentZone ? " current" : ""
                          }`}
                          onClick={() => controlZone(zone.id)}
                          disabled={
                            actionState === "starting" ||
                            actionState === "stopping"
                          }
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
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </motion.aside>

      <section className="area-stage" aria-live="polite">
        {selectedEntry ? (
          <>
            <div className="area-image-fallback">
              <span>{selectedEntry.zone.name}</span>
            </div>
            <Image
              key={selectedEntry.zone.id}
              src={selectedEntry.zone.tabletImageUrl}
              alt={selectedEntry.zone.name}
              fill
              priority
              sizes="(max-width: 768px) 58vw, 66vw"
              className="area-image"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <div className="area-stage-shade" />
            <div className="area-stage-copy">
              <span>{selectedEntry.area.name}</span>
              <h1>{selectedEntry.zone.name}</h1>
              <p>
                {selectedEntry.zone.subZones.length}{" "}
                {selectedEntry.zone.subZones.length === 1
                  ? "sub-zone"
                  : "sub-zones"}
              </p>
            </div>
          </>
        ) : (
          <div className="empty-areas">No zones are available.</div>
        )}

        <PlaybackControls
          onPlay={() =>
            selectedEntry
              ? controlZone(selectedEntry.zone.id)
              : Promise.resolve()
          }
          busy={actionState === "starting"}
          statusMessage={statusMessage}
          showPrimary={false}
        />
      </section>
    </main>
  );
}
