import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

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
  fetchStudySpots,
  logDistractionEvent,
  patchCompanion,
  postSession,
} from "./src/api";
import { BottomNav, type TabName } from "./src/components/BottomNav";
import { type SpotMatch, activeSpot, getReading, nearestSpot } from "./src/location";
import { CheckpointScreen } from "./src/screens/CheckpointScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { RecapScreen } from "./src/screens/RecapScreen";
import { SessionSummary, type SessionOutcome } from "./src/components/SessionSummary";
import { CommunityScreen } from "./src/screens/CommunityScreen";
import { ScheduleScreen } from "./src/screens/ScheduleScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { type Account, currentAccount, signOut } from "./src/auth";
import { clearSessionNotification, showSessionNotification } from "./src/sessionNotification";
import { colors } from "./src/theme";
import { useFocusSession } from "./src/useFocusSession";
import { useRecallCheck } from "./src/useRecallCheck";

export default function App() {
  const { state, start, stop, resolveCheckpoint, addBonusXp } = useFocusSession();
  const [tab, setTab] = useState<TabName>("home");
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [spots, setSpots] = useState<StudySpot[]>([]);
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
      const [nextCompanion, nextSpots, nextRecap, nextBoard] = await Promise.all([
        fetchCompanion(),
        fetchStudySpots(),
        fetchRecap(),
        // Non-fatal: the board is a nice-to-have, and a friendless demo
        // account shouldn't blank the whole screen.
        fetchLeaderboard().catch(() => null),
      ]);
      setCompanion(nextCompanion);
      setSpots(nextSpots);
      setRecap(nextRecap);
      setLeaderboard(nextBoard);
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
    if (account) void load();
  }, [account, load]);

  const checkIn = useCallback(async () => {
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
  }, [spots]);

  const multiplier = match?.inside ? match.spot.multiplier : 1;

  const handleStart = useCallback(() => {
    start(pledge);
    void showSessionNotification(Date.now());
  }, [start, pledge]);

  const handleStop = useCallback(async () => {
    const finished = stop();
    if (!finished) return;

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
  }, [stop, state.distractedMs, match, spots, load]);

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
    (patch: { color?: PigColor; accessory?: PigAccessory; name?: string }) => {
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
        <StatusBar style="dark" />
        <LoginScreen onSignedIn={setAccount} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.screen}>
          {tab === "home" && (
            <HomeScreen
              companion={companion}
              spots={spots}
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
              onCustomise={handleCustomise}
              onPledgeChange={setPledge}
              onStart={handleStart}
              onStop={handleStop}
            />
          )}
          {tab === "recap" && (
            <RecapScreen
              companion={companion}
              recap={recap}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          )}
          {tab === "schedule" && <ScheduleScreen />}
          {tab === "community" && <CommunityScreen leaderboard={leaderboard} />}
          {tab === "settings" && (
            <SettingsScreen
              companion={companion}
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
        <SafeAreaView edges={["bottom"]} style={styles.navSafe}>
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  navSafe: { backgroundColor: colors.surface },
});
