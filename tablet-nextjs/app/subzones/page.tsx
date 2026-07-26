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

function formatElementName(elementId: string) {
  return elementId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function SubZonesPage() {
  const {
    layout,
    connectionState,
    runtimeStatus,
    controlSubZone,
    pauseSequence,
    resumeSequence,
  } = useTabletContext();
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
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
        <p>Loading sub-zones…</p>
      </main>
    );
  }

  const subZoneEntries = layout.areas.flatMap((area) =>
    area.zones.flatMap((zone) =>
      zone.subZones.map((subZone) => ({ area, zone, subZone })),
    ),
  );
  const activeEntry =
    runtimeStatus.playback_state !== "idle"
      ? subZoneEntries.find(
          ({ subZone }) =>
            subZone.element_id === runtimeStatus.active_element_id,
        )
      : undefined;
  const selectedEntry =
    activeEntry ??
    subZoneEntries.find(
      ({ subZone }) => subZone.element_id === selectedElementId,
    ) ?? subZoneEntries[0];

  async function handleSubZone(zoneId: string, elementId: string) {
    const entry = subZoneEntries.find(
      ({ zone, subZone }) =>
        zone.id === zoneId && subZone.element_id === elementId,
    );

    if (!entry) return;
    const isCurrentSubZone =
      runtimeStatus.active_element_id === elementId;

    setSelectedElementId(elementId);
    setActionState("starting");
    setStatusMessage(
      isCurrentSubZone && runtimeStatus.playback_state === "playing"
        ? "Pausing sub-zone…"
        : isCurrentSubZone && runtimeStatus.playback_state === "paused"
          ? "Resuming sub-zone…"
          : "Activating sub-zone…",
    );

    const result =
      isCurrentSubZone && runtimeStatus.playback_state === "playing"
        ? await pauseSequence()
        : isCurrentSubZone && runtimeStatus.playback_state === "paused"
          ? await resumeSequence()
          : await controlSubZone(zoneId, entry.subZone);

    if (result.status === "success") {
      setActionState("playing");
      setStatusMessage(
        isCurrentSubZone && runtimeStatus.playback_state === "playing"
          ? "Sub-zone paused"
          : "Sub-zone is active",
      );
    } else {
      setActionState("error");
      setStatusMessage("");
      toast.error("Unable to control sub-zone", {
        description: result.message,
      });
    }
  }

  return (
    <main className="areas-shell">
      <header className="areas-header">
        <div className="areas-menu-button">
          <span>Sub-zones</span>
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
          <span>Lighting elements</span>
          <small>{subZoneEntries.length} available</small>
        </div>

        <div className="areas-list">
          {layout.areas.map((area, areaIndex) => {
            const isActiveArea =
              runtimeStatus.active_area_id === area.id &&
              runtimeStatus.playback_state !== "idle";

            return (
            <section
              className={`area-list-item${isActiveArea ? " playing" : ""}`}
              key={area.id}
            >
              <div className="zone-group-title">
                <small>{String(areaIndex + 1).padStart(2, "0")}</small>
                <strong>{area.name}</strong>
              </div>

              {area.zones.map((zone) => {
                const isActiveZone =
                  runtimeStatus.active_zone_id === zone.id &&
                  runtimeStatus.playback_state !== "idle";

                return (
                <div
                  className={`subzone-group${
                    isActiveZone ? " playing" : ""
                  }`}
                  key={zone.id}
                >
                  <span className="subzone-group-name">
                    {zone.name}
                  </span>
                  <div className="zone-menu-items">
                    {zone.subZones.map((subZone) => {
                      const isCurrentSubZone =
                        runtimeStatus.active_element_id ===
                        subZone.element_id;
                      const isPlaying =
                        isCurrentSubZone &&
                        runtimeStatus.playback_state === "playing";

                      return (
                      <div
                        className={`zone-menu-row subzone-menu-row${
                          selectedEntry?.subZone.element_id ===
                          subZone.element_id
                            ? " active"
                            : ""
                        }${isCurrentSubZone ? " playing" : ""}`}
                        key={subZone.element_id}
                      >
                        <button
                          type="button"
                          className="zone-select-button"
                          onClick={() =>
                            setSelectedElementId(subZone.element_id)
                          }
                        >
                          <span>{formatElementName(subZone.element_id)}</span>
                          <small>{subZone.intensity} intensity</small>
                        </button>
                        <button
                          type="button"
                          className={`area-play-button${
                            isCurrentSubZone ? " current" : ""
                          }`}
                          onClick={() =>
                            handleSubZone(zone.id, subZone.element_id)
                          }
                          disabled={
                            actionState === "starting" ||
                            actionState === "stopping"
                          }
                          aria-label={`${
                            isPlaying ? "Pause" : "Play"
                          } ${formatElementName(subZone.element_id)}`}
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
                </div>
                );
              })}
            </section>
            );
          })}
        </div>
      </motion.aside>

      <section className="area-stage" aria-live="polite">
        {selectedEntry ? (
          <>
            <div className="area-image-fallback">
              <span>{formatElementName(selectedEntry.subZone.element_id)}</span>
            </div>
            <Image
              key={selectedEntry.subZone.element_id}
              src={selectedEntry.subZone.tabletImageUrl}
              alt={formatElementName(selectedEntry.subZone.element_id)}
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
              <span>
                {selectedEntry.area.name} / {selectedEntry.zone.name}
              </span>
              <h1>{formatElementName(selectedEntry.subZone.element_id)}</h1>
              <p>{selectedEntry.subZone.intensity} intensity</p>
            </div>
          </>
        ) : (
          <div className="empty-areas">No sub-zones are available.</div>
        )}

        <PlaybackControls
          onPlay={() =>
            selectedEntry
              ? handleSubZone(
                  selectedEntry.zone.id,
                  selectedEntry.subZone.element_id,
                )
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
