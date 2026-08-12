"use client";

import { useEffect } from "react";

function preventTouchZoom() {
  const blockGesture = (event: Event) => event.preventDefault();

  const blockMultiTouch = (event: TouchEvent) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  };

  document.addEventListener("gesturestart", blockGesture, { passive: false });
  document.addEventListener("gesturechange", blockGesture, { passive: false });
  document.addEventListener("gestureend", blockGesture, { passive: false });
  document.addEventListener("touchmove", blockMultiTouch, { passive: false });

  return () => {
    document.removeEventListener("gesturestart", blockGesture);
    document.removeEventListener("gesturechange", blockGesture);
    document.removeEventListener("gestureend", blockGesture);
    document.removeEventListener("touchmove", blockMultiTouch);
  };
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  useEffect(() => preventTouchZoom(), []);

  return null;
}
