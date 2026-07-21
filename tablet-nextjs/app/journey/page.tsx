"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DeviceStatuses } from "../../components/device-statuses";
import { useTabletContext } from "../../contexts/tablet-context";

const sections = [
  {
    key: "areas",
    number: "01",
    title: "Areas",
    description: "Browse and activate experience areas",
  },
  {
    key: "zones",
    number: "02",
    title: "Zones",
    description: "View the zones available in each area",
  },
  {
    key: "subzones",
    number: "03",
    title: "Sub-zones",
    description: "Control individual lighting elements",
  },
] as const;

export default function JourneyPage() {
  const { layout, connectionState } = useTabletContext();
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
        <p>Loading your journey…</p>
      </main>
    );
  }

  const areaCount = layout.areas.length;
  const zoneCount = layout.areas.reduce(
    (total, area) => total + area.zones.length,
    0,
  );
  const subZoneCount = layout.areas.reduce(
    (total, area) =>
      total +
      area.zones.reduce(
        (zoneTotal, zone) => zoneTotal + zone.subZones.length,
        0,
      ),
    0,
  );
  const counts = {
    areas: areaCount,
    zones: zoneCount,
    subzones: subZoneCount,
  };

  return (
    <main className="journey-shell">
      <header className="journey-header">
        <div className="mini-brand">
          <span>RP</span>
          Raspberry Pi Tablet
        </div>

        <DeviceStatuses />
      </header>

      <section className="journey-panel dashboard-panel">
        <div className="journey-title">
          <span>Experience controls</span>
          <h1>Choose what you want to control</h1>
          <p>
            Your complete layout is loaded and ready from the socket server.
          </p>
        </div>

        <div className="choice-grid dashboard-grid">
          {sections.map((section, index) => (
            <motion.button
              type="button"
              className="choice-card dashboard-card"
              key={section.key}
              data-section={section.key}
              onClick={() => {
                if (section.key === "areas") {
                  router.push("/areas");
                } else if (section.key === "zones") {
                  router.push("/zones");
                } else {
                  router.push("/subzones");
                }
              }}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduceMotion ? 0 : index * 0.08,
                duration: reduceMotion ? 0.1 : 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={reduceMotion ? undefined : { y: -6 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            >
              <span className="choice-number">{section.number}</span>
              <span className="choice-copy">
                <strong>{section.title}</strong>
                <small>{section.description}</small>
              </span>
              <span className="dashboard-count">
                {counts[section.key]}
              </span>
              <span className="choice-arrow">→</span>
            </motion.button>
          ))}
        </div>
      </section>
    </main>
  );
}
