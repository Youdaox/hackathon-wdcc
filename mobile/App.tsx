import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  type AwayReason,
  type Companion,
  type PigAccessory,
  type PigColor,
  type Leaderboard,
  type Recap,
  type StudySpot,
  fetchCompanion,
  fetchLeaderboard,
  fetchRecap,
  fetchSchedule,
  fetchStudySpots,
  logDistractionEvent,
  patchCompanion,
  postSession,
} from "./src/api";
import { BottomNav, type TabName } from "./src/components/BottomNav";
import { type SpotMatch, activeSpot, getReading, nearestSpot } from "./src/location";
import { CheckpointScreen } from "./src/screens/CheckpointScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PlantSetupScreen } from "./src/screens/PlantSetupScreen";
import { RecapScreen } from "./src/screens/RecapScreen";
import { SessionSummary, type SessionOutcome } from "./src/components/SessionSummary";
import { CommunityScreen } from "./src/screens/CommunityScreen";
import { ScheduleScreen } from "./src/screens/ScheduleScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { type Account, currentAccount, signOut } from "./src/auth";
import { GEO_OPT_IN_KEY } from "./src/config";
import { clearSessionNotification, showSessionNotification } from "./src/sessionNotification";
import { useTheme } from "./src/theme";
import { useFocusSession } from "./src/useFocusSession";
import { type PlantSessionSummary, usePlantMode } from "./src/usePlantMode";
import { useRecallCheck } from "./src/useRecallCheck";

const LAST_PLANT_SUMMARY_KEY = "incline.lastPlantSummary.v1";

export default function App() {
  const { colors: c, isDark } = useTheme();
  const { state, start, stop, setPlantActive, resolveCheckpoint, addBonusXp } =
    useFocusSession();
  const handlePlantedChange = useCallback(
    (planted: boolean) => setPlantActive(planted),
    [setPlantActive],
  );
  const {
    state: plantState,
    begin: beginPlantMode,
    confirmSessionStarted: confirmPlantSessionStarted,
    stop: stopPlantMode,
  } = usePlantMode({ onPlantedChange: handlePlantedChange });
  const [tab, setTab] = useState<TabName>("home");
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [spots, setSpots] = useState<StudySpot[]>([]);
  const [blocks, setBlocks] = useState<import("./src/api").StudyBlock[]>([]);
  const [match, setMatch] = useState<SpotMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pledge, setPledge] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);
  /** Null until the stored session has been checked, so we don't flash the login screen. */
  const [authChecked, setAuthChecked] = useState(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  /** Location is opt-in: nothing prompts until the user turns it on. */
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(GEO_OPT_IN_KEY)
      .then((v) => setLocationEnabled(v === "true"))
      .catch(() => {});
  }, []);

  const toggleLocation = useCallback((enabled: boolean) => {
    setLocationEnabled(enabled);
    void AsyncStorage.setItem(GEO_OPT_IN_KEY, String(enabled)).catch(() => {});
  }, []);
  const [plantSetup, setPlantSetup] = useState(false);
  const [lastPlantSummary, setLastPlantSummary] = useState<PlantSessionSummary | null>(null);

  // The recall check needs a course to ask about. Until the schedule lands on
  // mobile there's no linked block, so it falls back to general study skills —
  // which the route already handles for an unrecognised course.
  const recall = useRecallCheck({
    running: state.running,
    focusedMs: state.focusedMs,
    course: "your current course",
    onCorrect: addBonusXp,
  });

  const load = useCallback(async () => {
    try {
      const [nextCompanion, nextSpots, nextRecap, nextBoard, nextBlocks] = await Promise.all([
        fetchCompanion(),
        fetchStudySpots(),
        fetchRecap(),
        // Non-fatal: the board is a nice-to-have, and a friendless demo
        // account shouldn't blank the whole screen.
        fetchLeaderboard().catch(() => null),
        // Non-fatal: the home card falls back to "no study block scheduled".
        fetchSchedule().catch(() => []),
      ]);
      setCompanion(nextCompanion);
      setSpots(nextSpots);
      setRecap(nextRecap);
      setLeaderboard(nextBoard);
      setBlocks(nextBlocks);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? `Can't reach the server — ${error.message}` : "Can't reach the server.");
    }
  }, []);

  useEffect(() => {
    void currentAccount()
      .then(setAccount)
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    // Only load once signed in — every endpoint resolves the user from the
    // session cookie, so calling them first just yields 401s.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (account) void load();
  }, [account, load]);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(LAST_PLANT_SUMMARY_KEY)
      .then((raw) => {
        if (!cancelled && raw) setLastPlantSummary(JSON.parse(raw) as PlantSessionSummary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const checkIn = useCallback(async () => {
    if (!locationEnabled) {
      setNotice("Turn on the location bonus in Settings first.");
      return;
    }
    setChecking(true);
    try {
      const reading = await getReading();
      if (!reading) {
        setMatch(null);
        setNotice("No location reading — sessions still count at 1x.");
        return;
      }
      setMatch(nearestSpot(reading.lat, reading.lng, spots));
      setNotice(null);
    } finally {
      setChecking(false);
    }
  }, [spots, locationEnabled]);

  const multiplier = match?.inside ? match.spot.multiplier : 1;

  const beginLiveSession = useCallback((plantMode: boolean) => {
    start(pledge, plantMode);
    void showSessionNotification(Date.now());
  }, [start, pledge]);

  const handleStart = useCallback(() => {
    setPlantSetup(true);
    void beginPlantMode();
  }, [beginPlantMode]);

  const cancelPlantSetup = useCallback(() => {
    setPlantSetup(false);
    stopPlantMode();
  }, [stopPlantMode]);

  const continueWithoutPlantMode = useCallback(() => {
    setPlantSetup(false);
    stopPlantMode();
    beginLiveSession(false);
  }, [beginLiveSession, stopPlantMode]);

  /* Sensor transitions are external-system events; these effects bridge them
   * into the session engine at deliberate boundaries. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!plantSetup || plantState.phase !== "planted") return;
    confirmPlantSessionStarted();
    setPlantSetup(false);
    beginLiveSession(true);
  }, [plantSetup, plantState.phase, confirmPlantSessionStarted, beginLiveSession]);

  useEffect(() => {
    if (!account || !state.running || !state.plantMode || plantState.active) return;
    void beginPlantMode();
  }, [account, state.running, state.plantMode, plantState.active, beginPlantMode]);

  useEffect(() => {
    if (
      state.running &&
      state.plantMode &&
      plantState.phase === "planted" &&
      !plantState.trackingSession
    ) {
      confirmPlantSessionStarted();
    }
  }, [
    state.running,
    state.plantMode,
    plantState.phase,
    plantState.trackingSession,
    confirmPlantSessionStarted,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleStop = useCallback(async () => {
    const finished = stop();
    if (!finished) return;

    const plantSummary = finished.plantMode ? stopPlantMode() : null;
    if (plantSummary) {
      setLastPlantSummary(plantSummary);
      void AsyncStorage.setItem(LAST_PLANT_SUMMARY_KEY, JSON.stringify(plantSummary)).catch(
        () => {},
      );
    }

    void clearSessionNotification();

    setBusy(true);
    try {
      const insideSpot = match?.inside ? activeSpot(match.spot.lat, match.spot.lng, spots) : null;
      const result = await postSession({
        startedAt: finished.startedAt,
        endedAt: finished.endedAt,
        focusedMs: finished.focusedMs,
        locationName: insideSpot?.name ?? null,
        pledgeMinutes: finished.pledgeMinutes,
        bonusXp: finished.bonusXp,
        distractions: finished.distractions,
      });
      setOutcome({
        focusedMs: finished.focusedMs,
        distractedMs: state.distractedMs,
        breaks: finished.distractions.length,
        xpEarned: result.pet_growth_delta,
        voided: result.voided,
        voidReason: result.void_reason,
        pledgeMinutes: finished.pledgeMinutes,
        locationName: insideSpot?.name ?? null,
      });
      setNotice(null);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? `Session not synced — ${error.message}` : "Session not synced.");
    } finally {
      setBusy(false);
    }
  }, [stop, stopPlantMode, state.distractedMs, match, spots, load]);

  /**
   * Resolves the return check-in.
   *
   * The reason is attached to the distraction record first, so whichever path
   * follows carries it: "ended" stops the session immediately and the reason
   * rides along in the session payload, everything else logs the event live so
   * a self-reported drift survives an unclean session end.
   */
  const handleCheckpoint = useCallback(
    (reason: AwayReason, guessedSeconds: number | null) => {
      const pending = state.pending;
      resolveCheckpoint(reason, guessedSeconds);

      if (reason === "ended") {
        void handleStop();
        return;
      }

      if (pending) {
        void logDistractionEvent({
          durationMs: pending.durationMs,
          reason,
          guessedSeconds,
        }).catch(() => {
          // Already on the session payload; a failed live log isn't worth
          // interrupting someone who just got back to work.
        });
      }

      setNotice(
        reason === "distraction"
          ? "Logged honestly — that costs a little HP."
          : "Logged. No penalty for that one.",
      );
    },
    [state.pending, resolveCheckpoint, handleStop],
  );

  /**
   * Coat and accessory live on the server, not in local state — the web reads
   * the same row, so a pig recoloured here is recoloured there. Applied
   * optimistically so the swatch responds instantly.
   */
  const handleCustomise = useCallback(
    (patch: {
      species?: Companion["species"];
      color?: PigColor;
      accessory?: PigAccessory;
      check_in_emotion?: Companion["check_in_emotion"];
      name?: string;
    }) => {
      setCompanion((current) => (current ? { ...current, ...patch } : current));
      void patchCompanion(patch)
        .then(load)
        .catch(() => setNotice("Couldn't save that change."));
    },
    [load],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!authChecked) return null;

  if (!account) {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <LoginScreen onSignedIn={setAccount} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView style={[styles.safe, { backgroundColor: c.canvas }]} edges={["top"]}>
        <View style={[styles.screen, { backgroundColor: c.canvas }]}>
          {tab === "home" && (
            <HomeScreen
              companion={companion}
              spots={spots}
              blocks={blocks}
              match={match}
              checking={checking}
              state={state}
              multiplier={multiplier}
              busy={busy}
              notice={notice}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onCheckIn={checkIn}
              recall={recall}
              pledge={pledge}
              focusedTodayMinutes={recap?.days.at(-1)?.focused_minutes ?? 0}
              streak={recap?.streak ?? 0}
              onMoodChange={(emotion) => handleCustomise({ check_in_emotion: emotion })}
              onPledgeChange={setPledge}
              onStart={handleStart}
              onStop={handleStop}
            />
          )}
          {tab === "recap" && (
            <RecapScreen
              companion={companion}
              recap={recap}
              plantSummary={lastPlantSummary}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}
          {tab === "schedule" && <ScheduleScreen />}
          {tab === "community" && <CommunityScreen leaderboard={leaderboard} />}
          {tab === "settings" && (
            <SettingsScreen
              companion={companion}
              locationEnabled={locationEnabled}
              onToggleLocation={toggleLocation}
              onRename={(name) => handleCustomise({ name })}
              onCustomise={handleCustomise}
              account={{ displayName: account.name }}
              onSignOut={() => {
                void signOut().then(() => {
                  setAccount(null);
                  setCompanion(null);
                });
              }}
            />
          )}
        </View>
        <SafeAreaView edges={["bottom"]} style={[styles.navSafe, { backgroundColor: c.surface }]}>
          <BottomNav active={tab} onChange={setTab} />
        </SafeAreaView>

        <SessionSummary
          outcome={outcome}
          petName={companion?.name ?? "Oinky"}
          onDismiss={() => setOutcome(null)}
        />

        <CheckpointScreen
          pending={state.pending}
          petName={companion?.name ?? "Fern"}
          onResolve={handleCheckpoint}
        />

        {plantSetup && (
          <PlantSetupScreen
            state={plantState}
            companion={companion}
            onCancel={cancelPlantSetup}
            onContinueWithoutSensor={continueWithoutPlantMode}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screen: { flex: 1 },
  navSafe: {},
});
