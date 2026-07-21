"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTabletContext } from "../contexts/tablet-context";

type Screen = "splash" | "idle";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("splash");
  const { connect, connectionState, errorMessage, layout } = useTabletContext();
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
    <main className="tablet-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <AnimatePresence mode="wait">
        {screen === "splash" ? (
          <motion.section
            key="splash"
            className="screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 1.04 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.6 }}
            aria-label="Welcome"
          >
            <motion.div
              className="brand"
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: reduceMotion ? 0.15 : 1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <motion.span
                className="brand-mark"
                animate={
                  reduceMotion
                    ? undefined
                    : { rotate: [0, 8, -5, 0], scale: [1, 1.08, 1] }
                }
                transition={{ delay: 0.65, duration: 0.8 }}
              >
                R P
              </motion.span>
              <div>
                <span className="brand-name">Raspberry Pi Tablet</span>
                <span className="brand-caption">
                  Raspberry Pi tablet experience controller
                </span>
              </div>
            </motion.div>
          </motion.section>
        ) : (
          <motion.section
            key="idle"
            className="screen"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0.15 : 0.7,
              ease: [0.16, 1, 0.3, 1],
            }}
            aria-labelledby="idle-title"
          >
            <div className="idle-content">
              <motion.div
                className="eyebrow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.2 }}
              >
                Welcome
              </motion.div>
              <h1 id="idle-title">Ready to begin?</h1>
              <p>Your immersive experience is waiting.</p>

              <motion.button
                type="button"
                className="begin-button"
                onClick={beginJourney}
                disabled={
                  connectionState === "connecting" ||
                  connectionState === "connected"
                }
                whileHover={reduceMotion ? undefined : { scale: 1.025 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              >
                <span>
                  {connectionState === "connecting"
                    ? "Connecting"
                    : connectionState === "connected"
                      ? "Loading journey"
                      : connectionState === "error"
                        ? "Try again"
                        : "Begin journey"}
                </span>
                {connectionState === "connecting" ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <span className="arrow" aria-hidden="true">
                    →
                  </span>
                )}
              </motion.button>

              <div className="status" aria-live="polite">
                {connectionState === "connected" && (
                  <span className="success">
                    <i /> Connected to the experience
                  </span>
                )}
                {connectionState === "error" && (
                  <span className="error">{errorMessage}</span>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
