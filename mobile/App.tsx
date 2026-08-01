import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { type Companion, type StudySpot, fetchCompanion, fetchStudySpots, postSession } from "./src/api";
import { type SpotMatch, activeSpot, getReading, nearestSpot } from "./src/location";
import { useFocusSession } from "./src/useFocusSession";
import { CompanionCard } from "./src/components/CompanionCard";
import { FocusPanel } from "./src/components/FocusPanel";
import { LocationCard } from "./src/components/LocationCard";
import { colors } from "./src/theme";

/**
 * Incline — Expo Go build.
 *
 * This app verifies focus and syncs it; it does not enforce anything. Expo Go
 * has no access to app blocking on either platform, so the cost of leaving is
 * emotional rather than punitive — which is the same bargain the web app makes.
 */
export default function App() {
  const { state, start, stop } = useFocusSession();

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [spots, setSpots] = useState<StudySpot[]>([]);
  const [match, setMatch] = useState<SpotMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextCompanion, nextSpots] = await Promise.all([fetchCompanion(), fetchStudySpots()]);
      setCompanion(nextCompanion);
      setSpots(nextSpots);
      setNotice(null);
    } catch (error) {
      // The backend being unreachable is the single most likely demo failure,
      // so name it plainly instead of leaving an empty screen.
      setNotice(error instanceof Error ? `Can't reach the server — ${error.message}` : "Can't reach the server.");
    }
  }, []);

  useEffect(() => {
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
      // Re-derive the spot at session end rather than trusting the check-in
      // from the start: the rule is where you *finish*, matching the web app.
      const insideSpot = match?.inside ? activeSpot(match.spot.lat, match.spot.lng, spots) : null;

      const result = await postSession({
        startedAt: finished.startedAt,
        endedAt: finished.endedAt,
        focusedMs: finished.focusedMs,
        locationName: insideSpot?.name ?? null,
        distractions: finished.distractions,
      });

      setNotice(
        result.pet_growth_delta > 0
          ? `+${result.pet_growth_delta} XP synced.`
          : "Session synced — not enough focus for XP this time.",
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Session not synced — ${error.message}`
          : "Session not synced.",
      );
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
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.title}>Incline</Text>
            <Text style={styles.subtitle}>Verified focus only</Text>
          </View>

          <CompanionCard companion={companion} />

          <FocusPanel
            state={state}
            multiplier={multiplier}
            busy={busy}
            onStart={start}
            onStop={handleStop}
          />

          <LocationCard spots={spots} match={match} checking={checking} onCheckIn={checkIn} />

          {notice && <Text style={styles.notice}>{notice}</Text>}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  header: { gap: 2, marginBottom: 2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14 },
  notice: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 8,
  },
});
