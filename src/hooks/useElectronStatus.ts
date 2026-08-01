"use client";

import { useEffect } from "react";
import { backgroundStatus, IDLE_STATUS } from "@/lib/backgroundStatus";
import type { ActiveSession } from "@/lib/types";

/** Sends the renderer's focus calculation to Electron's always-on-top status pill. */
export function useElectronStatus(active: ActiveSession | null) {
  useEffect(() => {
    const send = () => window.electronAPI?.setBackgroundStatus(backgroundStatus(active));
    send();
    if (!active) return;

    const interval = window.setInterval(send, 1_000);
    return () => {
      window.clearInterval(interval);
      window.electronAPI?.setBackgroundStatus(IDLE_STATUS);
    };
  }, [active]);
}
