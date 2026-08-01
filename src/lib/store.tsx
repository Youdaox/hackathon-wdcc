"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Companion, FocusSession, StudyBlock } from "./types";
import { STORAGE_KEYS, clearAll, loadJSON, saveJSON, uid } from "./storage";
import { applyIdleDecay, applySession, createCompanion, type GrowthResult } from "./companion";
import { LIVE_SESSION_KEY, useFocusSession, type StartSessionInput } from "@/hooks/useFocusSession";
import { useGeolocation, type GeoReading, type GeoStatus } from "@/hooks/useGeolocation";
import { activeZone, nearestZone, type BonusZone, type ZoneMatch } from "./zones";
import { startOfDay } from "./time";

/** Result of the session that just ended — drives the summary screen. */
export interface SessionOutcome {
  session: FocusSession;
  growth: GrowthResult;
}

/** A block as it arrives from Canvas — no local id yet. */
export type CanvasImportBlock = Omit<StudyBlock, "id" | "createdAt" | "source" | "externalId"> & {
  externalId: string;
};

export interface ImportResult {
  added: number;
  updated: number;
}

interface InclineContextValue {
  /** False until localStorage has been read, so we never render mismatched HTML. */
  hydrated: boolean;
  blocks: StudyBlock[];
  addBlock: (input: Omit<StudyBlock, "id" | "createdAt" | "source">) => void;
  updateBlock: (id: string, patch: Partial<StudyBlock>) => void;
  removeBlock: (id: string) => void;
  /** Upserts Canvas-imported blocks by `externalId`. Returns what changed. */
  importCanvasBlocks: (incoming: CanvasImportBlock[]) => ImportResult;
  companion: Companion;
  renameCompanion: (name: string) => void;
  sessions: FocusSession[];
  todaysSessions: FocusSession[];
  active: ReturnType<typeof useFocusSession>["active"];
  elapsedMs: number;
  startSession: (input: StartSessionInput) => void;
  endSession: () => void;
  cancelSession: () => void;
  /** Awards flat XP to the running session (correct recall check). */
  addBonusXp: (amount: number) => void;
  outcome: SessionOutcome | null;
  dismissOutcome: () => void;
  resetEverything: () => void;

  // --- Location bonus (optional; the app is fully usable without it) --------
  geoEnabled: boolean;
  setGeoEnabled: (enabled: boolean) => void;
  geoStatus: GeoStatus;
  geoReading: GeoReading | null;
  /** The zone the user is inside right now, or null. */
  currentZone: BonusZone | null;
  /** Closest zone either way — lets the UI show a near miss. */
  nearest: ZoneMatch | null;
  /** Multiplier that would apply if the session ended now. Always ≥ 1. */
  liveMultiplier: number;
}

const InclineContext = createContext<InclineContextValue | null>(null);

export function InclineProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [blocks, setBlocks] = useState<StudyBlock[]>([]);
  const [companion, setCompanion] = useState<Companion>(() => createCompanion());
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  // Opt-in is remembered, so a reload doesn't re-prompt — but we still never
  // ask for location until the user turns it on.
  const [geoEnabled, setGeoEnabled] = useState(false);

  // --- Hydrate --------------------------------------------------------------
  // localStorage isn't readable during SSR, so the first render always uses
  // defaults and this mount-once effect swaps in the saved state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setBlocks(loadJSON<StudyBlock[]>(STORAGE_KEYS.schedule, []));
    setCompanion(applyIdleDecay(loadJSON<Companion>(STORAGE_KEYS.companion, createCompanion())));
    setSessions(loadJSON<FocusSession[]>(STORAGE_KEYS.sessions, []));
    setGeoEnabled(loadJSON<boolean>(STORAGE_KEYS.geo, false));
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // --- Persist (skipped until hydrated so we don't clobber saved data) ------
  useEffect(() => {
    if (hydrated) saveJSON(STORAGE_KEYS.schedule, blocks);
  }, [blocks, hydrated]);

  useEffect(() => {
    if (hydrated) saveJSON(STORAGE_KEYS.companion, companion);
  }, [companion, hydrated]);

  useEffect(() => {
    if (hydrated) saveJSON(STORAGE_KEYS.sessions, sessions);
  }, [sessions, hydrated]);

  useEffect(() => {
    if (hydrated) saveJSON(STORAGE_KEYS.geo, geoEnabled);
  }, [geoEnabled, hydrated]);

  // --- Location bonus -------------------------------------------------------
  const { status: geoStatus, reading: geoReading } = useGeolocation(geoEnabled);

  const currentZone = useMemo(
    () => (geoReading ? activeZone(geoReading.lat, geoReading.lng) : null),
    [geoReading],
  );
  const nearest = useMemo(
    () => (geoReading ? nearestZone(geoReading.lat, geoReading.lng) : null),
    [geoReading],
  );
  const liveMultiplier = currentZone?.multiplier ?? 1;

  // --- Session completion: the one place growth is awarded ------------------
  // Read the companion through a ref rather than a state updater: this handler
  // has side effects (logging the session, opening the summary), and updaters
  // must stay pure or StrictMode's double-invoke would double-record.
  const companionRef = useRef(companion);
  useEffect(() => {
    companionRef.current = companion;
  }, [companion]);

  // The session hook knows nothing about location, so the zone bonus is
  // resolved here, at the moment the session lands.
  const zoneRef = useRef<BonusZone | null>(null);
  useEffect(() => {
    zoneRef.current = currentZone;
  }, [currentZone]);

  const handleComplete = useCallback((finished: FocusSession) => {
    const zone = zoneRef.current;
    const withBonus: FocusSession = {
      ...finished,
      xpMultiplier: zone?.multiplier ?? 1,
      zoneName: zone?.name,
    };
    const growth = applySession(companionRef.current, withBonus, withBonus.xpMultiplier);
    const recorded: FocusSession = {
      ...withBonus,
      xpEarned: growth.xpEarned,
      hpDelta: growth.hpDelta,
    };
    setCompanion(growth.companion);
    setSessions((all) => [recorded, ...all].slice(0, 200));
    setOutcome({ session: recorded, growth });
  }, []);

  const { active, start, end, cancel, elapsedMs, addBonusXp } = useFocusSession(handleComplete);

  // --- Schedule CRUD --------------------------------------------------------
  const addBlock = useCallback(
    (input: Omit<StudyBlock, "id" | "createdAt" | "source">) => {
      setBlocks((prev) =>
        [...prev, { ...input, id: uid(), createdAt: Date.now(), source: "manual" as const }].sort(
          (a, b) => a.startMin - b.startMin,
        ),
      );
    },
    [],
  );

  const updateBlock = useCallback((id: string, patch: Partial<StudyBlock>) => {
    setBlocks((prev) =>
      prev
        .map((b) => (b.id === id ? { ...b, ...patch } : b))
        .sort((a, b) => a.startMin - b.startMin),
    );
  }, []);

  // Import reports back how many blocks it touched, so it reads the current
  // schedule through a ref rather than a state updater — an updater has to stay
  // pure, and this one needs to return a count to the caller.
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const importCanvasBlocks = useCallback((incoming: CanvasImportBlock[]): ImportResult => {
    const current = blocksRef.current;
    let added = 0;
    let updated = 0;

    const merged = [...current];
    for (const block of incoming) {
      // Matching on externalId is what makes re-importing safe: a changed
      // lecture time updates the row instead of adding a second one.
      const index = merged.findIndex(
        (existing) => existing.source === "canvas" && existing.externalId === block.externalId,
      );

      if (index === -1) {
        merged.push({
          ...block,
          id: uid(),
          createdAt: Date.now(),
          source: "canvas",
        });
        added += 1;
        continue;
      }

      const existing = merged[index];
      const changed =
        existing.title !== block.title ||
        existing.course !== block.course ||
        existing.startMin !== block.startMin ||
        existing.endMin !== block.endMin ||
        existing.days.join() !== block.days.join();

      if (changed) {
        merged[index] = { ...existing, ...block };
        updated += 1;
      }
    }

    setBlocks(merged.sort((a, b) => a.startMin - b.startMin));
    return { added, updated };
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const renameCompanion = useCallback((name: string) => {
    setCompanion((prev) => ({ ...prev, name: name.trim() || prev.name }));
  }, []);

  const resetEverything = useCallback(() => {
    clearAll();
    window.localStorage.removeItem(LIVE_SESSION_KEY);
    setBlocks([]);
    setCompanion(createCompanion());
    setSessions([]);
    setOutcome(null);
    cancel();
  }, [cancel]);

  const todaysSessions = useMemo(() => {
    const dayStart = startOfDay();
    return sessions.filter((s) => s.endedAt >= dayStart);
  }, [sessions]);

  const value = useMemo<InclineContextValue>(
    () => ({
      hydrated,
      blocks,
      addBlock,
      updateBlock,
      removeBlock,
      importCanvasBlocks,
      companion,
      renameCompanion,
      sessions,
      todaysSessions,
      active,
      elapsedMs,
      startSession: start,
      endSession: end,
      cancelSession: cancel,
      addBonusXp,
      outcome,
      dismissOutcome: () => setOutcome(null),
      resetEverything,
      geoEnabled,
      setGeoEnabled,
      geoStatus,
      geoReading,
      currentZone,
      nearest,
      liveMultiplier,
    }),
    [
      hydrated,
      blocks,
      addBlock,
      updateBlock,
      removeBlock,
      importCanvasBlocks,
      companion,
      renameCompanion,
      sessions,
      todaysSessions,
      active,
      elapsedMs,
      start,
      end,
      cancel,
      addBonusXp,
      outcome,
      resetEverything,
      geoEnabled,
      geoStatus,
      geoReading,
      currentZone,
      nearest,
      liveMultiplier,
    ],
  );

  return <InclineContext.Provider value={value}>{children}</InclineContext.Provider>;
}

export function useIncline(): InclineContextValue {
  const ctx = useContext(InclineContext);
  if (!ctx) throw new Error("useIncline must be used inside <InclineProvider>");
  return ctx;
}
