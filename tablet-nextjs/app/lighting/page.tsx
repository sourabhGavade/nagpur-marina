"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeviceStatuses } from "../../components/device-statuses";
import {
  useTabletContext,
  type Lighting,
  type LightingModel,
} from "../../contexts/tablet-context";

const MODEL_LABELS: Record<LightingModel, string> = {
  "main-model": "Main Model",
  "clubhouse-model": "Clubhouse",
};

function lightingModel(lighting: Lighting): LightingModel {
  return lighting.subZones[0]!.model;
}

function sortLightings(items: Lighting[]) {
  return [...items].sort((a, b) => a.sequence_order - b.sequence_order);
}

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

export default function LightingPage() {
  const { layout, connectionState, controlLighting, hardwareOnline } =
    useTabletContext();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [onById, setOnById] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!layout || connectionState !== "connected") {
      router.replace("/");
    }
  }, [connectionState, layout, router]);

  const mainModel = useMemo(
    () =>
      sortLightings(
        layout?.lightings.filter(
          (item) => lightingModel(item) === "main-model",
        ) ?? [],
      ),
    [layout],
  );
  const clubhouse = useMemo(
    () =>
      sortLightings(
        layout?.lightings.filter(
          (item) => lightingModel(item) === "clubhouse-model",
        ) ?? [],
      ),
    [layout],
  );

  if (!layout) {
    return <MarinaLoading label="Loading lighting…" />;
  }

  async function toggleLighting(lighting: Lighting) {
    const nextOn = !onById[lighting.id];
    const action = nextOn ? "activate" : "deactivate";

    setBusyId(lighting.id);
    setOnById((current) => ({ ...current, [lighting.id]: nextOn }));

    const result = await controlLighting(lighting.id, action);

    if (result.status !== "success") {
      setOnById((current) => ({ ...current, [lighting.id]: !nextOn }));
      toast.error("Unable to control lighting", {
        description: result.message,
      });
    }

    setBusyId(null);
  }

  function renderPanel(title: string, items: Lighting[]) {
    return (
      <section className="lighting-panel">
        <header className="lighting-panel-header">
          <h2>{title}</h2>
        </header>
        <ul className="lighting-list">
          {items.map((lighting, index) => {
            const isOn = Boolean(onById[lighting.id]);
            const busy = busyId === lighting.id;

            return (
              <li
                key={lighting.id}
                className={`lighting-row${isOn ? " is-on" : ""}`}
              >
                <span className="lighting-index">{index + 1}.</span>
                <div className="lighting-copy">
                  <strong>{lighting.name}</strong>
                </div>
                <button
                  type="button"
                  className={`lighting-toggle${isOn ? " is-on" : ""}`}
                  aria-pressed={isOn}
                  aria-label={`${isOn ? "Turn off" : "Turn on"} ${lighting.name}`}
                  disabled={busy || hardwareOnline === false}
                  onClick={() => void toggleLighting(lighting)}
                >
                  <span className="lighting-toggle-knob" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <main className="marina-experience marina-shell lighting-page">
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

        <div className="lighting-board">
          {renderPanel(MODEL_LABELS["main-model"], mainModel)}
          {renderPanel(MODEL_LABELS["clubhouse-model"], clubhouse)}
        </div>
      </motion.div>
    </main>
  );
}
