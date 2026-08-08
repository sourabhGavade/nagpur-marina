"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useTabletContext } from "@/contexts/tablet-context";

/** Device/browser back should stop playback the same way as the Stop button. */
export function useStopOnBrowserBack() {
  const { stopSequence } = useTabletContext();

  useEffect(() => {
    const onPopState = () => {
      void stopSequence().then((result) => {
        if (result.status === "error") {
          toast.error("Unable to stop sequence", {
            description: result.message,
          });
        }
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [stopSequence]);
}
