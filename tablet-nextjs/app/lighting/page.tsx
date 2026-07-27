"use client";

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
  clubhouse: "Clubhouse",
};

function sortLightings(items: Lighting[]) {
  return [...items].sort((a, b) => a.sequence_order - b.sequence_order);
}

export default function LightingPage() {
  const { layout, connectionState, controlLighting, hardwareOnline } =
    useTabletContext();
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
        layout?.lightings.filter((item) => item.model === "main-model") ?? [],
      ),
    [layout],
  );
  const clubhouse = useMemo(
    () =>
      sortLightings(
        layout?.lightings.filter((item) => item.model === "clubhouse") ?? [],
      ),
    [layout],
  );

  if (!layout) {
    return (
      <main className="journey-shell journey-loading">
        <span className="spinner" aria-hidden="true" />
        <p>Loading lighting…</p>
      </main>
    );
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
          <span>Lighting group</span>
          <h2>{title}</h2>
          <small>
            {items.length} {items.length === 1 ? "circuit" : "circuits"}
          </small>
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
                <span className="lighting-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="lighting-copy">
                  <strong>{lighting.name}</strong>
                  <small>
                    {lighting.subZones.length}{" "}
                    {lighting.subZones.length === 1 ? "sub-zone" : "sub-zones"}
                  </small>
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
    <main className="areas-shell lighting-page">
      <header className="areas-header">
        <div className="areas-menu-button">
          <span>Lighting</span>
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

      <div className="lighting-board">
        {renderPanel(MODEL_LABELS["main-model"], mainModel)}
        {renderPanel(MODEL_LABELS.clubhouse, clubhouse)}
      </div>
    </main>
  );
}
