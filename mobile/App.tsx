import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";

import {
  type AwayReason,
  type Companion,
  type Recap,
  type StudySpot,
  fetchCompanion,
  fetchRecap,
  fetchStudySpots,
  logDistractionEvent,
  postSession,
} from "./src/api";
import { BottomNav, type TabName } from "./src/components/BottomNav";
import { type SpotMatch, activeSpot, getReading, nearestSpot } from "./src/location";
import { CheckpointScreen } from "./src/screens/CheckpointScreen";
import { InterceptScreen } from "./src/screens/InterceptScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { RanksScreen } from "./src/screens/RanksScreen";
import { RecapScreen } from "./src/screens/RecapScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { clearSessionNotification, showSessionNotification } from "./src/sessionNotification";
import { colors } from "./src/theme";
import { useFocusSession } from "./src/useFocusSession";

export default function App() {
  const { state, start, stop, resolveCheckpoint, recordIntercept } = useFocusSession();
  const [tab, setTab] = useState<TabName>("home");
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [spots, setSpots] = useState<StudySpot[]>([]);
  const [match, setMatch] = useState<SpotMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pledge, setPledge] = useState(0);
  /** Set when a Shortcuts automation deep-links us mid-session. */
  const [intercept, setIntercept] = useState<{ appLabel: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextCompanion, nextSpots, nextRecap] = await Promise.all([
        fetchCompanion(),
        fetchStudySpots(),
        fetchRecap(),
      ]);
      setCompanion(nextCompanion);
      setSpots(nextSpots);
      setRecap(nextRecap);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? `Can't reach the server — ${error.message}` : "Can't reach the server.");
    }
  }, []);

  useEffect(() => {
    // Initial hydration is intentionally owned by this mount-only effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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

  /**
   * Handles `incline://intercept?app=Instagram`.
   *
   * The URL comes from a Personal Automation the user built in Shortcuts —
   * iOS gives no way to detect another app opening, so the user has to opt
   * into telling us. Ignored unless a session is actually running, otherwise
   * opening the app normally would trigger the screen.
   */
  const handleUrl = useCallback(
    (url: string | null) => {
      if (!url) return;
      const { hostname, path, queryParams } = Linking.parse(url);

      // The target lands in a different field depending on how we were opened:
      // `incline://intercept` puts it in hostname (there is no path at all),
      // while Expo Go delivers `exp://host/--/intercept`, leaving it as the
      // last path segment. Checking one field only works in one of the two.
      const segments = (path ?? "").split("/").filter(Boolean);
      const target = segments[segments.length - 1] ?? hostname;
      if (target !== "intercept") return;
      if (!state.running) return;
      const raw = queryParams?.app;
      const appLabel = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 60) : null;
      setIntercept({ appLabel });
    },
    [state.running],
  );

  useEffect(() => {
    // Cold start: the URL that launched the app isn't delivered as an event.
    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [handleUrl]);

  const resolveIntercept = useCallback(
    (bypassed: boolean) => {
      const appLabel = intercept?.appLabel ?? null;
      setIntercept(null);
      recordIntercept(appLabel, bypassed);
      void logDistractionEvent({ durationMs: 0, appLabel, bypassed }).catch(() => {});
      if (bypassed) {
        setNotice(
          state.pledgeMinutes > 0
            ? "Pledge broken — this session won't earn XP."
            : "Logged. Your companion noticed.",
        );
      }
    },
    [intercept, recordIntercept, state.pledgeMinutes],
  );

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
        distractions: finished.distractions,
      });
      setNotice(
        result.voided
          ? result.void_reason === "bypassed"
            ? "Session forfeited — you pushed past an intercept."
            : "Session forfeited — you left your pledge behind."
          : result.pet_growth_delta > 0
            ? `+${result.pet_growth_delta} XP synced.`
            : "Session synced.",
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? `Session not synced — ${error.message}` : "Session not synced.");
    } finally {
      setBusy(false);
    }
  }, [stop, match, spots, load]);

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

  // Abandoning a pledged session ends it immediately. Syncing from an effect
  // rather than inside the engine keeps the engine pure state, and the server
  // still decides the forfeit — verified time will be short of the pledge.
  useEffect(() => {
    if (!state.abandoned) return;
    void handleStop();
  }, [state.abandoned, handleStop]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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
              pledge={pledge}
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
          {tab === "ranks" && <RanksScreen />}
          {tab === "settings" && <SettingsScreen />}
        </View>
        <SafeAreaView edges={["bottom"]} style={styles.navSafe}>
          <BottomNav active={tab} onChange={setTab} />
        </SafeAreaView>

        {intercept && (
          <InterceptScreen
            appLabel={intercept.appLabel}
            focusedMs={state.focusedMs}
            pledgeMinutes={state.pledgeMinutes}
            onReturn={() => resolveIntercept(false)}
            onBypass={() => resolveIntercept(true)}
          />
        )}

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
