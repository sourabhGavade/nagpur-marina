"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeviceStatuses } from "@/components/device-statuses";
import { MarinaLoading } from "@/components/marina-loading";
import { useTabletContext } from "@/contexts/tablet-context";
import { useGoHome } from "@/hooks/use-go-home";
import { useStopOnBrowserBack } from "@/hooks/use-stop-on-browser-back";
import type { Lighting, LightingModel } from "@/lib/types";
import { MODEL_LABELS } from "@/lib/consts";

const TOGGLE_COOLDOWN_MS = 500;

function lightingModel(lighting: Lighting): LightingModel {
  return lighting.subZones[0]!.model;
}

function sortLightings(items: Lighting[]) {
  return [...items].sort((a, b) => a.sequence_order - b.sequence_order);
}

export default function LightingPage() {
  const { layout, connectionState, controlLighting, hardwareOnline } =
    useTabletContext();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const goHome = useGoHome();
  useStopOnBrowserBack();
  const [onById, setOnById] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyIdRef = useRef<string | null>(null);

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
    if (busyIdRef.current === lighting.id) return;

    const nextOn = !onById[lighting.id];
    const action = nextOn ? "activate" : "deactivate";

    busyIdRef.current = lighting.id;
    setBusyId(lighting.id);
    setOnById((current) => ({ ...current, [lighting.id]: nextOn }));

    // Wait for the cooldown and then control the lighting.
    const [, result] = await Promise.all([
      new Promise<void>((resolve) => setTimeout(resolve, TOGGLE_COOLDOWN_MS)),
      controlLighting(lighting.id, action),
    ]);

    if (result.status !== "success") {
      setOnById((current) => ({ ...current, [lighting.id]: !nextOn }));
      toast.error("Unable to control lighting", {
        description: result.message,
      });
    }

    // Reset the busy state.
    busyIdRef.current = null;
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

        <div className="lighting-board">
          {renderPanel(MODEL_LABELS["main-model"], mainModel)}
          {renderPanel(MODEL_LABELS["clubhouse-model"], clubhouse)}
        </div>
      </motion.div>
    </main>
  );
}
