"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanvasSessionStatus } from "@/app/api/canvas/session/route";
import { CanvasQueryError, fetchOverview, type CanvasOverview } from "@/lib/canvas/query";
import { useIncline, type ImportResult } from "@/lib/store";

/**
 * Canvas connection state for the UI.
 *
 * Login is a server round trip on purpose: the token goes into an httpOnly
 * cookie that this hook can never read back, so the only thing it tracks is
 * *whether* someone is connected and what their data looks like.
 */

export type CanvasPhase = "checking" | "disconnected" | "connected";

export interface CanvasState {
  phase: CanvasPhase;
  /** Where credentials came from — "env" means the deployment supplies them. */
  origin: CanvasSessionStatus["origin"];
  user: CanvasSessionStatus["user"] | null;
  baseUrl: string | null;
  overview: CanvasOverview | null;
  loadingOverview: boolean;
  /** Login failure, shown on the form. */
  loginError: string | null;
  loggingIn: boolean;
  /** Failure while fetching or importing, shown on the connected card. */
  error: string | null;
  lastImport: ImportResult | null;
  connect: (baseUrl: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  importTimetable: () => void;
  /** Loads fixture data without connecting — the no-Canvas demo path. */
  previewDemo: () => Promise<void>;
}

export function useCanvas(): CanvasState {
  const { importCanvasBlocks } = useIncline();

  const [phase, setPhase] = useState<CanvasPhase>("checking");
  const [origin, setOrigin] = useState<CanvasSessionStatus["origin"]>("none");
  const [user, setUser] = useState<CanvasSessionStatus["user"] | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [overview, setOverview] = useState<CanvasOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setError(null);
    try {
      setOverview(await fetchOverview());
    } catch (cause) {
      setOverview(null);
      setError(
        cause instanceof CanvasQueryError ? cause.message : "Couldn't load your Canvas data.",
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const applyStatus = useCallback(
    (status: CanvasSessionStatus) => {
      setOrigin(status.origin);
      setUser(status.user ?? null);
      setBaseUrl(status.baseUrl ?? null);
      setPhase(status.connected ? "connected" : "disconnected");
      return status.connected;
    },
    [],
  );

  // Ask the server who's connected. The cookie is httpOnly, so this is the only
  // way the client can find out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/canvas/session", { credentials: "same-origin" });
        const status = (await response.json()) as CanvasSessionStatus;
        if (cancelled) return;
        if (applyStatus(status)) void loadOverview();
      } catch {
        if (!cancelled) setPhase("disconnected");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyStatus, loadOverview]);

  const connect = useCallback(
    async (instance: string, token: string) => {
      setLoggingIn(true);
      setLoginError(null);
      try {
        const response = await fetch("/api/canvas/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ baseUrl: instance, token }),
        });
        const payload = (await response.json()) as CanvasSessionStatus & { error?: string };

        if (!response.ok) {
          setLoginError(payload.error ?? "Couldn't connect to Canvas.");
          return;
        }

        applyStatus(payload);
        await loadOverview();
      } catch {
        setLoginError("Couldn't reach the server. Are you offline?");
      } finally {
        setLoggingIn(false);
      }
    },
    [applyStatus, loadOverview],
  );

  const disconnect = useCallback(async () => {
    await fetch("/api/canvas/session", { method: "DELETE", credentials: "same-origin" });
    setPhase("disconnected");
    setOrigin("none");
    setUser(null);
    setBaseUrl(null);
    setOverview(null);
    setLastImport(null);
    setError(null);
    // Imported blocks are deliberately left in the schedule: disconnecting is
    // about the credential, not about deleting the user's timetable.
  }, []);

  const importTimetable = useCallback(() => {
    if (!overview) return;
    setLastImport(importCanvasBlocks(overview.studyBlocks));
  }, [overview, importCanvasBlocks]);

  const previewDemo = useCallback(async () => {
    // With no credentials configured the endpoint serves fixtures, so this is
    // the same query — it just comes back as `dataSource: "mock"`.
    setPhase("connected");
    setOrigin("none");
    await loadOverview();
  }, [loadOverview]);

  return {
    phase,
    origin,
    user,
    baseUrl,
    overview,
    loadingOverview,
    loginError,
    loggingIn,
    error,
    lastImport,
    connect,
    disconnect,
    refresh: loadOverview,
    importTimetable,
    previewDemo,
  };
}
