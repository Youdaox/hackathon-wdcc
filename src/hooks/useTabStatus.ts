"use client";

import { useEffect } from "react";
import { backgroundStatus } from "@/lib/backgroundStatus";
import type { ActiveSession } from "@/lib/types";

/** Keeps a background browser tab informative without affecting session scoring. */
export function useTabStatus(active: ActiveSession | null, companionName: string) {
  useEffect(() => {
    const updateTitle = () => {
      const status = backgroundStatus(active);
      document.title = status.phase === "idle"
        ? "Incline"
        : status.phase === "focused"
          ? `${companionName} is focused · Incline`
          : status.phase === "grace"
            ? `Come back to ${companionName} · Incline`
            : `${companionName} is losing focus · Incline`;
    };

    updateTitle();
    if (!active) return;
    const interval = window.setInterval(updateTitle, 1_000);
    return () => window.clearInterval(interval);
  }, [active, companionName]);
}
