"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTabletContext } from "../contexts/tablet-context";

type Screen = "splash" | "idle";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("splash");
  const { connect, connectionState, layout } = useTabletContext();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(
      () => setScreen("idle"),
      reduceMotion ? 500 : 2600,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (connectionState === "connected" && layout) {
      router.push("/journey");
    }
  }, [connectionState, layout, router]);

  function beginJourney() {
    connect();
  }

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[#050b18] text-[#f5f7fb]">
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

      <AnimatePresence mode="wait">
        {screen === "splash" ? (
          <motion.section
            key="splash"
            className="absolute inset-0 z-2 grid place-items-center p-8 sm:p-12 md:p-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.6 }}
            aria-label="Nagpur Marina"
          >
            <motion.div
              className="grid place-items-center"
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: reduceMotion ? 0.15 : 1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Image
                src="/assets/main_logo.png"
                alt="Nagpur Marina"
                width={720}
                height={240}
                priority
                className="h-auto w-[min(82vw,360px)] mix-blend-screen sm:w-[min(62vw,520px)]"
              />
            </motion.div>
          </motion.section>
        ) : (
          <motion.section
            key="idle"
            className="absolute inset-0 z-2 grid place-items-center p-6 sm:p-10 md:p-16"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0.15 : 0.7,
              ease: [0.16, 1, 0.3, 1],
            }}
            aria-labelledby="welcome-copy"
          >
            <motion.div
              className="flex h-full w-full max-w-9xl flex-col items-center justify-end gap-10 rounded-[28px] border-[1.5px] border-[rgba(212,175,100,0.55)] bg-black/20 px-5 py-9 text-center shadow-[0_0_0_1px_rgba(212,175,100,0.08),0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-[3px] sm:rounded-[44px] sm:px-16 sm:py-18"
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: reduceMotion ? 0.15 : 0.65,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Image
                src="/assets/main_logo.png"
                alt="Nagpur Marina"
                width={560}
                height={186}
                priority
                className="h-auto w-57.5 mix-blend-screen sm:w-125"
              />

              <motion.button
                type="button"
                onClick={beginJourney}
                disabled={
                  connectionState === "connecting" ||
                  connectionState === "connected"
                }
                whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="inline-flex h-20 min-w-[min(84vw,300px)] cursor-pointer items-center justify-center gap-3.5 rounded-full border-[1.5px] border-[rgba(212,175,100,0.85)] bg-[rgba(10,16,30,0.55)] px-9 text-[15px] font-semibold tracking-[0.04em] text-white transition-[background,border-color] duration-200 hover:border-[rgba(232,198,120,1)] hover:bg-[rgba(18,26,44,0.72)] focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-[rgba(212,175,100,0.95)] disabled:cursor-default disabled:opacity-80 sm:min-w-[min(72vw,340px)]"
              >
                {connectionState === "connecting"
                  ? "Connecting…"
                  : connectionState === "connected"
                    ? "Loading journey…"
                    : connectionState === "error"
                      ? "Try again"
                      : "Begin Journey"}
                {connectionState === "connecting" && (
                  <span
                    className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-[#f0d28a]"
                    aria-hidden="true"
                  />
                )}
              </motion.button>

              <p
                id="welcome-copy"
                className=" text-[14px] leading-[1.55] tracking-[0.01em] text-[rgba(245,247,251,0.92)] sm:text-[20px]"
              >
                Explore a world of waterfront luxury, curated lifestyle,
                <br />
                and unmatched experiences.
              </p>

              <div
                className="mt-4.5 min-h-6 text-[13px] text-[rgba(245,247,251,0.72)]"
                aria-live="polite"
              >
                {connectionState === "connected" && (
                  <span className="inline-flex items-center gap-2">
                    <i className="size-1.5 rounded-full bg-[#7ec65a] not-italic" />
                    Connected to the experience
                  </span>
                )}
                {connectionState === "error" && (
                  <span className="text-[#ff8f84]">
                    Error connecting to the experience
                  </span>
                )}

                <div className="flex flex-col items-center gap-1 text-sm font-bold">
                  <p>Please contact support:</p>
                  <p>Email: <a href="mailto:hoablnagpurmarinasupport@trzy.in" className="font-normal">hoablnagpurmarinasupport@trzy.in</a></p>
                  <p>Contact: <a href="tel:+916375724545" className="font-normal">+91 6375724545</a></p>
                </div>
              </div>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
