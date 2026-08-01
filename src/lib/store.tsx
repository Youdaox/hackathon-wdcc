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
import { usePathname } from "next/navigation";
import {
  PIG_COLOR_VALUES,
  PIG_ACCESSORY_VALUES,
  AVATAR_EMOTIONS,
  type AvatarEmotion,
  type Companion,
  type FocusSession,
  type PigAccessory,
  type PigColor,
  type StudyBlock,
} from "./types";
import { STORAGE_KEYS, clearAll, forUser, loadJSON, saveJSON, uid } from "./storage";
import { useDemoAuth } from "./demo-auth";
import {
  applyIdleDecay,
  applySession,
  awayMsPastGrace,
  createCompanion,
  hpLostForAwayMs,
  type GrowthResult,
} from "./companion";
import { LIVE_SESSION_KEY, liveSessionKeyForUser, useFocusSession, type StartSessionInput } from "@/hooks/useFocusSession";
import { useGeolocation, type GeoReading, type GeoStatus } from "@/hooks/useGeolocation";
import {
  useFocusTracking,
  type GazeAwayReason,
  type GazeStatus,
} from "@/hooks/useFocusTracking";
import type { GazePrediction } from "webgazer";
import type { GazeCalibration } from "./gaze";
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
  setCompanionColor: (color: PigColor) => void;
  setCompanionAccessory: (accessory: PigAccessory) => void;
  checkInWithCompanion: (emotion: AvatarEmotion) => void;
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

  // --- Eye tracking (optional; also never gates a session) ------------------
  eyeEnabled: boolean;
  setEyeEnabled: (enabled: boolean) => void;
  gazeStatus: GazeStatus;
  /** True while the user's gaze has been off-screen long enough to warn. */
  gazeWandering: boolean;
  /** Wander episodes detected during the running session. */
  gazeEpisodes: number;
  /** Latest gaze prediction in viewport coordinates. */
  gazePoint: GazePrediction | null;
  /** Live, undebounced reason the user reads as away — for describing, not scoring. */
  gazeReason: GazeAwayReason | null;
  /** How far the user got through the calibration dots. */
  gazeCalibration: GazeCalibration;
  setGazeCalibration: (state: GazeCalibration) => void;
}

const InclineContext = createContext<InclineContextValue | null>(null);

function hasAvatarCustomization(companion: Companion) {
  return companion.name !== "Oinky"
    || companion.color !== "pink"
    || companion.accessory !== "none"
    || companion.checkInEmotion !== null;
}

export function InclineProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useDemoAuth();
  const [hydrated, setHydrated] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  /** Prevents a local cache from overwriting the shared profile before it loads. */
  const [profileLoadedForUser, setProfileLoadedForUser] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<StudyBlock[]>([]);
  const [companion, setCompanion] = useState<Companion>(() => createCompanion());
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  // Opt-in is remembered, so a reload doesn't re-prompt — but we still never
  // ask for location until the user turns it on.
  const [geoEnabled, setGeoEnabled] = useState(false);
  // Same deal for the camera: remembered, but only ever opened during a session.
  const [eyeEnabled, setEyeEnabled] = useState(false);
  const [gazeCalibration, setGazeCalibration] = useState<GazeCalibration>("none");

  // --- Hydrate --------------------------------------------------------------
  // localStorage isn't readable during SSR, so the first render always uses
  // defaults and this mount-once effect swaps in the saved state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!currentUser) {
      setHydrated(false);
      setHydratedUserId(null);
      setProfileLoadedForUser(null);
      setBlocks([]);
      setCompanion(createCompanion());
      setSessions([]);
      return;
    }
    const userKey = (key: string) => forUser(key, currentUser.id);
    setHydrated(false);
    setHydratedUserId(null);
    setProfileLoadedForUser(null);
    setBlocks(loadJSON<StudyBlock[]>(userKey(STORAGE_KEYS.schedule), []));
    const loadedCompanion = loadJSON<Companion>(userKey(STORAGE_KEYS.companion), createCompanion());
    // Older saves predate coat/accessory customization, or may carry a coat
    // color that's since been retired (grey/brown) — fall back to defaults.
    const localCompanion = applyIdleDecay({
      ...loadedCompanion,
      color: PIG_COLOR_VALUES.includes(loadedCompanion.color) ? loadedCompanion.color : "pink",
      accessory: PIG_ACCESSORY_VALUES.includes(loadedCompanion.accessory)
        ? loadedCompanion.accessory
        : "none",
      checkInEmotion: loadedCompanion.checkInEmotion !== null
        && AVATAR_EMOTIONS.includes(loadedCompanion.checkInEmotion)
        ? loadedCompanion.checkInEmotion
        : null,
      checkInAt: typeof loadedCompanion.checkInAt === "number" ? loadedCompanion.checkInAt : null,
      nextCheckInAt:
        typeof loadedCompanion.nextCheckInAt === "number" ? loadedCompanion.nextCheckInAt : null,
    });
    setCompanion(localCompanion);
    setSessions(loadJSON<FocusSession[]>(userKey(STORAGE_KEYS.sessions), []));
    setGeoEnabled(loadJSON<boolean>(userKey(STORAGE_KEYS.geo), false));
    setEyeEnabled(loadJSON<boolean>(userKey(STORAGE_KEYS.eye), false));
    setGazeCalibration(loadJSON<GazeCalibration>(userKey(STORAGE_KEYS.eyeCalibration), "none"));
    setHydrated(true);
    setHydratedUserId(currentUser.id);
    let active = true;
    void fetch("/api/profile/companion")
      .then((response) => response.ok ? response.json() as Promise<{ companion: Companion }> : null)
      .then((payload) => {
        if (!active || !payload) return;
        // Focus/schedule data remains local today; only profile fields are
        // shared so loading a popup cannot replace an in-progress web profile.
        const sharedProfile = hasAvatarCustomization(payload.companion) || !hasAvatarCustomization(localCompanion)
          ? {
              ...localCompanion,
              name: payload.companion.name,
              color: payload.companion.color,
              accessory: payload.companion.accessory,
              checkInEmotion: payload.companion.checkInEmotion,
              checkInAt: payload.companion.checkInAt,
              nextCheckInAt: payload.companion.nextCheckInAt,
            }
          : localCompanion;
        setCompanion(sharedProfile);
        setProfileLoadedForUser(currentUser.id);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [currentUser]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // --- Persist (skipped until hydrated so we don't clobber saved data) ------
  useEffect(() => {
    if (hydrated && currentUser && hydratedUserId === currentUser.id) saveJSON(forUser(STORAGE_KEYS.schedule, currentUser.id), blocks);
  }, [blocks, currentUser, hydrated, hydratedUserId]);

  useEffect(() => {
    if (hydrated && currentUser && hydratedUserId === currentUser.id) saveJSON(forUser(STORAGE_KEYS.companion, currentUser.id), companion);
  }, [companion, currentUser, hydrated, hydratedUserId]);

  // The database profile is shared by the browser, Electron dashboard, and
  // its popup/overlay windows. Only avatar preferences belong here; focus
  // sessions remain account-local until they have a dedicated sync flow.
  useEffect(() => {
    if (!currentUser || profileLoadedForUser !== currentUser.id) return;
    void fetch("/api/profile/companion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: companion.name,
        color: companion.color,
        accessory: companion.accessory,
        checkInEmotion: companion.checkInEmotion,
        checkInAt: companion.checkInAt,
        nextCheckInAt: companion.nextCheckInAt,
      }),
    }).catch(() => undefined);
  }, [companion, currentUser, profileLoadedForUser]);

  useEffect(() => {
    if (hydrated && currentUser && hydratedUserId === currentUser.id) saveJSON(forUser(STORAGE_KEYS.sessions, currentUser.id), sessions);
  }, [sessions, currentUser, hydrated, hydratedUserId]);

  useEffect(() => {
    if (hydrated && currentUser && hydratedUserId === currentUser.id) saveJSON(forUser(STORAGE_KEYS.geo, currentUser.id), geoEnabled);
  }, [currentUser, geoEnabled, hydrated, hydratedUserId]);

  useEffect(() => {
    if (hydrated && currentUser && hydratedUserId === currentUser.id) saveJSON(forUser(STORAGE_KEYS.eye, currentUser.id), eyeEnabled);
  }, [currentUser, eyeEnabled, hydrated, hydratedUserId]);

  useEffect(() => {
    if (hydrated && currentUser && hydratedUserId === currentUser.id) saveJSON(forUser(STORAGE_KEYS.eyeCalibration, currentUser.id), gazeCalibration);
  }, [currentUser, gazeCalibration, hydrated, hydratedUserId]);

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

  /**
   * The companion's HP when the running session began, before any live decay.
   *
   * Live decay is a *preview* of what the session will cost, not a second
   * source of truth — so when the session lands we rewind to this anchor and
   * let `applySession` compute the real figure, exactly as the server does from
   * the same recorded distractions. Without the rewind the finished session's
   * cost would be charged twice: once as it accrued, once at the end.
   */
  const hpAnchor = useRef<number | null>(null);
  /** HP already drained during the current away stretch. */
  const drainedThisStretch = useRef(0);

  const handleComplete = useCallback((finished: FocusSession) => {
    const zone = zoneRef.current;
    const withBonus: FocusSession = {
      ...finished,
      xpMultiplier: zone?.multiplier ?? 1,
      zoneName: zone?.name,
    };
    // Cleared first: this also stops the drain loop from banking one last
    // partial second on top of the authoritative result as it tears down.
    const anchor = hpAnchor.current;
    hpAnchor.current = null;
    const base =
      anchor === null ? companionRef.current : { ...companionRef.current, hp: anchor };
    const growth = applySession(base, withBonus, withBonus.xpMultiplier);
    const recorded: FocusSession = {
      ...withBonus,
      xpEarned: growth.xpEarned,
      hpDelta: growth.hpDelta,
    };
    setCompanion(growth.companion);
    setSessions((all) => [recorded, ...all].slice(0, 200));
    setOutcome({ session: recorded, growth });
  }, []);

  const liveSessionKey = currentUser ? liveSessionKeyForUser(currentUser.id) : LIVE_SESSION_KEY;
  const { active, start, end, cancel, elapsedMs, addBonusXp, setGazeAway } =
    useFocusSession(handleComplete, liveSessionKey);

  // --- Live decay -----------------------------------------------------------
  // The pet loses health *while* you're away rather than being docked once the
  // session is filed. Watching it slump in real time is the entire point: a
  // number that only moves after the fact can't pull anyone back to their desk.

  // Anchored per session, so a discard can put back exactly what it took.
  const sessionId = active?.id ?? null;
  useEffect(() => {
    if (sessionId === null) {
      hpAnchor.current = null;
      return;
    }
    hpAnchor.current = companionRef.current.hp;
    drainedThisStretch.current = 0;
  }, [sessionId]);

  // Keyed on when the current absence began. Each away stretch gets its own
  // grace window, so this effect's lifetime is exactly one stretch.
  const awaySince = active?.awaySince ?? null;
  useEffect(() => {
    if (awaySince === null || sessionId === null) return;
    drainedThisStretch.current = 0;

    // Derived from wall-clock elapsed time, never accumulated per tick: a
    // backgrounded tab has its timers throttled to roughly once a minute, and a
    // tick-counting drain would quietly stop charging for exactly the absence
    // we most want to catch — the one where you switched away entirely.
    const drain = () => {
      // The session may have landed since the last tick; its final HP is
      // authoritative and must not be decayed further.
      if (hpAnchor.current === null) return;
      const owed = hpLostForAwayMs(awayMsPastGrace(Date.now() - awaySince));
      const unbanked = owed - drainedThisStretch.current;
      if (unbanked <= 0) return;
      drainedThisStretch.current = owed;
      setCompanion((prev) => ({ ...prev, hp: Math.max(0, prev.hp - unbanked) }));
    };

    const id = window.setInterval(drain, 1_000);
    return () => {
      window.clearInterval(id);
      // Bank the final partial second. Without this the live total would fall a
      // fraction short of what `applySession` charges, and every session would
      // end with a small unexplained drop.
      drain();
    };
  }, [awaySince, sessionId]);

  /** Discarding a session undoes the health it cost — it officially never happened. */
  const cancelSession = useCallback(() => {
    const anchor = hpAnchor.current;
    hpAnchor.current = null;
    if (anchor !== null) {
      setCompanion((prev) => (prev.hp === anchor ? prev : { ...prev, hp: anchor }));
    }
    cancel();
  }, [cancel]);

  // --- Eye tracking ---------------------------------------------------------
  // The camera only ever runs while a session is live, and only if the user
  // asked for it. No session, no webcam — that's the whole privacy promise.
  //
  // The Electron overlay and status windows each load this same provider in
  // their own separate page — without this check, opening either while a
  // session is live starts a second concurrent WebGazer/TensorFlow pipeline
  // on top of the dashboard's, which is heavy enough to freeze everything.
  // Neither window needs gaze data at all, so it's just skipped there.
  const pathname = usePathname();
  const isTrackingWindow = pathname === "/overlay" || pathname === "/status";
  const gaze = useFocusTracking(eyeEnabled && active !== null && !isTrackingWindow, gazeCalibration);

  // Nothing counts against the session while the calibration overlay is still
  // up — the user is clicking dots, not studying.
  const gazeAway = gaze.wandering && gazeCalibration !== "none";
  useEffect(() => {
    setGazeAway(gazeAway);
  }, [gazeAway, setGazeAway]);

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

  const setCompanionColor = useCallback((color: PigColor) => {
    setCompanion((prev) => ({ ...prev, color }));
  }, []);

  const setCompanionAccessory = useCallback((accessory: PigAccessory) => {
    setCompanion((prev) => ({ ...prev, accessory }));
  }, []);

  const checkInWithCompanion = useCallback((emotion: AvatarEmotion) => {
    const checkedInAt = Date.now();
    // A varied delay keeps the prompt from feeling like a rigid notification.
    const delayMs = (5 + Math.floor(Math.random() * 56)) * 60_000;
    setCompanion((prev) => ({
      ...prev,
      checkInEmotion: emotion,
      checkInAt: checkedInAt,
      nextCheckInAt: checkedInAt + delayMs,
    }));
  }, []);

  const resetEverything = useCallback(() => {
    if (currentUser) {
      for (const key of Object.values(STORAGE_KEYS)) {
        window.localStorage.removeItem(forUser(key, currentUser.id));
      }
    } else clearAll();
    window.localStorage.removeItem(liveSessionKey);
    setBlocks([]);
    setCompanion(createCompanion());
    setSessions([]);
    setOutcome(null);
    setGazeCalibration("none");
    // Dropped before `cancel()`, so the drain loop can't tear down and charge a
    // last fraction of a second against the brand-new companion.
    hpAnchor.current = null;
    cancel();
  }, [cancel, currentUser, liveSessionKey]);

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
      setCompanionColor,
      setCompanionAccessory,
      checkInWithCompanion,
      sessions,
      todaysSessions,
      active,
      elapsedMs,
      startSession: start,
      endSession: end,
      cancelSession,
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
      eyeEnabled,
      setEyeEnabled,
      gazeStatus: gaze.status,
      gazeWandering: gazeAway,
      gazeEpisodes: gaze.episodes,
      gazePoint: gaze.point,
      gazeReason: gaze.reason,
      gazeCalibration,
      setGazeCalibration,
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
      setCompanionColor,
      setCompanionAccessory,
      checkInWithCompanion,
      sessions,
      todaysSessions,
      active,
      elapsedMs,
      start,
      end,
      cancelSession,
      addBonusXp,
      outcome,
      resetEverything,
      geoEnabled,
      geoStatus,
      geoReading,
      currentZone,
      nearest,
      liveMultiplier,
      eyeEnabled,
      gaze.status,
      gaze.episodes,
      gaze.point,
      gaze.reason,
      gazeAway,
      gazeCalibration,
    ],
  );

  return <InclineContext.Provider value={value}>{children}</InclineContext.Provider>;
}

export function useIncline(): InclineContextValue {
  const ctx = useContext(InclineContext);
  if (!ctx) throw new Error("useIncline must be used inside <InclineProvider>");
  return ctx;
}
