import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { type Companion, type StudySpot, fetchCompanion, fetchStudySpots, postSession } from "./src/api";
import { BottomNav, type TabName } from "./src/components/BottomNav";
import { type SpotMatch, activeSpot, getReading, nearestSpot } from "./src/location";
import { HomeScreen } from "./src/screens/HomeScreen";
import { RanksScreen } from "./src/screens/RanksScreen";
import { RecapScreen } from "./src/screens/RecapScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { colors } from "./src/theme";
import { useFocusSession } from "./src/useFocusSession";

export default function App() {
  const { state, start, stop } = useFocusSession();
  const [tab, setTab] = useState<TabName>("home");
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [spots, setSpots] = useState<StudySpot[]>([]);
  const [match, setMatch] = useState<SpotMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restrictedApps, setRestrictedApps] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [nextCompanion, nextSpots] = await Promise.all([fetchCompanion(), fetchStudySpots()]);
      setCompanion(nextCompanion);
      setSpots(nextSpots);
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

  const handleStop = useCallback(async () => {
    const finished = stop();
    if (!finished) return;

    setBusy(true);
    try {
      const insideSpot = match?.inside ? activeSpot(match.spot.lat, match.spot.lng, spots) : null;
      const result = await postSession({
        startedAt: finished.startedAt,
        endedAt: finished.endedAt,
        focusedMs: finished.focusedMs,
        locationName: insideSpot?.name ?? null,
        distractions: finished.distractions,
      });
      setNotice(result.pet_growth_delta > 0 ? `+${result.pet_growth_delta} XP synced.` : "Session synced.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? `Session not synced — ${error.message}` : "Session not synced.");
    } finally {
      setBusy(false);
    }
  }, [stop, match, spots, load]);

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
              onStart={start}
              onStop={handleStop}
            />
          )}
          {tab === "recap" && <RecapScreen companion={companion} />}
          {tab === "ranks" && <RanksScreen />}
          {tab === "settings" && (
            <SettingsScreen
              enabled={restrictedApps}
              onToggle={(appName, value) =>
                setRestrictedApps((current) => ({ ...current, [appName]: value }))
              }
            />
          )}
        </View>
        <SafeAreaView edges={["bottom"]} style={styles.navSafe}>
          <BottomNav active={tab} onChange={setTab} />
        </SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  navSafe: { backgroundColor: colors.surface },
});
