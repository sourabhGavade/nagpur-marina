"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DeviceStatuses } from "@/components/device-statuses";
import { useTabletContext } from "@/contexts/tablet-context";
import { sections } from "@/lib/consts";

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
        <p className="relative z-2 text-[14px]">Loading your journey…</p>
      </main>
    );
  }

  const areaCount = layout.areas.length;
  const zoneCount = layout.areas.reduce(
    (total, area) => total + area.zones.length,
    0,
  );
  const lightingCount = layout.lightings.length;
  const counts = {
    areas: areaCount,
    zones: zoneCount,
    lighting: lightingCount,
  };

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
          <Image
            src="/assets/main_logo.png"
            alt="Nagpur Marina"
            width={240}
            height={80}
            priority
            className="marina-logo"
          />
          <DeviceStatuses />
        </header>

        <section className="flex min-h-0 flex-1 flex-col justify-center py-4 sm:py-8">
          <div className="text-center sm:text-left">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[rgba(212,175,100,0.9)] uppercase sm:text-[12px]">
              Experience controls
            </span>
            <h1 className="mt-3 text-[clamp(28px,4.2vw,52px)] leading-[1.05] font-semibold tracking-[-0.04em] text-[#f5f7fb] sm:whitespace-nowrap">
              Choose what you want to control
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-[1.55] text-[rgba(245,247,251,0.72)] sm:text-[17px]">
              Your complete layout is loaded and ready from the socket server.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 md:grid-cols-3">
            {sections.map((section, index) => (
              <motion.button
                type="button"
                key={section.key}
                onClick={() => {
                  if (section.key === "areas") {
                    router.push("/areas");
                  } else if (section.key === "zones") {
                    router.push("/zones");
                  } else {
                    router.push("/lighting");
                  }
                }}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: reduceMotion ? 0 : index * 0.08,
                  duration: reduceMotion ? 0.1 : 0.45,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={reduceMotion ? undefined : { y: -4, scale: 1.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                className="group flex min-h-45 cursor-pointer flex-col justify-between rounded-3xl border-[1.5px] border-[rgba(212,175,100,0.35)] bg-[rgba(10,16,30,0.55)] p-6 text-left transition-[background,border-color] duration-200 hover:border-[rgba(232,198,120,0.85)] hover:bg-[rgba(18,26,44,0.72)] focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-[rgba(212,175,100,0.95)] sm:min-h-55 sm:rounded-[28px] sm:p-7"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[12px] font-semibold tracking-[0.08em] text-[rgba(212,175,100,0.75)]">
                    {section.number}
                  </span>
                  <span className="text-[12px] font-semibold text-[rgba(245,247,251,0.45)]">
                    {counts[section.key]}
                  </span>
                </div>

                <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <strong className="text-[22px] font-semibold tracking-[-0.03em] text-[#f5f7fb] sm:text-[26px]">
                      {section.title}
                    </strong>
                    <small className="text-[12px] leading-[1.45] text-[rgba(245,247,251,0.62)] sm:text-[13px]">
                      {section.description}
                    </small>
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[rgba(212,175,100,0.55)] bg-[rgba(10,16,30,0.65)] text-[18px] text-[#f0d28a] transition-colors group-hover:border-[rgba(232,198,120,1)] group-hover:bg-[rgba(18,26,44,0.9)]">
                    →
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      </motion.div>
    </main>
  );
}
