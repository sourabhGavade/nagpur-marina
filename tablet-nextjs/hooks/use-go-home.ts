"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { useTabletContext } from "@/contexts/tablet-context";

export function useGoHome() {
  const router = useRouter();
  const { stopSequence } = useTabletContext();

  return useCallback(async () => {
    const result = await stopSequence();
    if (result.status === "error") {
      toast.error("Unable to stop sequence", {
        description: result.message,
      });
    }

    router.push("/journey");
  }, [router, stopSequence]);
}
