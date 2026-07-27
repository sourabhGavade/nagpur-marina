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

function MarinaLoading({ label }: { label: string }) {
  return (
    <main className="relative isolate flex min-h-svh items-center justify-center gap-4 overflow-hidden bg-[#050b18] text-[rgba(245,247,251,0.72)]">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <Image
          src="/assets/main_bg.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-b from-[#050b18]/20 to-[#050b18]/30" />
      </div>
      <span
        className="relative z-2 inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#f0d28a]"
        aria-hidden="true"
      />
      <p className="relative z-2 text-[14px]">{label}</p>
    </main>
  );
}

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
    return <MarinaLoading label="Loading zones…" />;
  }

  const zoneEntries = layout.areas.flatMap((area) =>
    area.zones.map((zone) => ({ area, zone })),
  );
  const activeEntry =
    runtimeStatus.playback_state !== "idle"
      ? zoneEntries.find(({ zone }) => zone.id === runtimeStatus.active_zone_id)
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

  function zoneStatus(
    zoneId: string,
    areaZones: { id: string }[],
    zoneIndex: number,
  ) {
    const isCurrentZone = runtimeStatus.active_zone_id === zoneId;
    if (isCurrentZone && runtimeStatus.playback_state === "playing") {
      return "Playing";
    }
    if (isCurrentZone && runtimeStatus.playback_state === "paused") {
      return "Paused";
    }

    if (runtimeStatus.playback_state !== "idle") {
      const activeIndex = areaZones.findIndex(
        (zone) => zone.id === runtimeStatus.active_zone_id,
      );
      if (activeIndex >= 0 && zoneIndex === activeIndex + 1) {
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
            onClick={() => router.push("/journey")}
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
            <h2>Zones</h2>

            <div className="marina-chapters-list">
              {layout.areas.map((area) => {
                const isActiveArea =
                  runtimeStatus.active_area_id === area.id &&
                  runtimeStatus.playback_state !== "idle";

                return (
                  <section
                    key={area.id}
                    className={`marina-chapter${isActiveArea ? " is-active" : ""}`}
                  >
                    <div className="marina-chapter-title">
                      <span>{area.name}</span>
                    </div>

                    <ul>
                      {area.zones.map((zone, zoneIndex) => {
                        const isCurrentZone =
                          runtimeStatus.active_zone_id === zone.id;
                        const isPlaying =
                          isCurrentZone &&
                          runtimeStatus.playback_state === "playing";
                        const status = zoneStatus(
                          zone.id,
                          area.zones,
                          zoneIndex,
                        );
                        const isSelected = selectedEntry?.zone.id === zone.id;

                        return (
                          <li
                            key={zone.id}
                            className={
                              [
                                isSelected ? "is-selected" : "",
                                isCurrentZone ? "is-playing" : "",
                                status === "Up Next" ? "is-next" : "",
                              ]
                                .filter(Boolean)
                                .join(" ") || undefined
                            }
                          >
                            <button
                              type="button"
                              className="marina-zone-row"
                              onClick={() => setSelectedZoneId(zone.id)}
                            >
                              <span>{zone.name}</span>
                              {status ? <small>{status}</small> : null}
                            </button>
                            <button
                              type="button"
                              className={`marina-play-button marina-play-button--sm${
                                isCurrentZone ? " is-current" : ""
                              }`}
                              onClick={() => controlZone(zone.id)}
                              disabled={
                                actionState === "starting" ||
                                actionState === "stopping"
                              }
                              aria-label={`${isPlaying ? "Pause" : "Play"} ${zone.name}`}
                            >
                              {isPlaying ? (
                                <i className="pause-icon" aria-hidden="true" />
                              ) : (
                                <i className="play-icon" aria-hidden="true" />
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
          </aside>

          <section className="marina-stage" aria-live="polite">
            {selectedEntry ? (
              <>
                <div className="marina-stage-fallback" aria-hidden="true" />
                <Image
                  key={selectedEntry.zone.id}
                  src={selectedEntry.zone.tabletImageUrl}
                  alt={selectedEntry.zone.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="marina-stage-image"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              </>
            ) : (
              <div className="marina-stage-empty">No zones are available.</div>
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
        </div>
      </motion.div>
    </main>
  );
}
