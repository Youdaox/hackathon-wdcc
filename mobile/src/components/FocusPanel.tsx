import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FocusState } from "../useFocusSession";
import { colors, formatDuration, roundedFont } from "../theme";

const PLEDGES = [0, 15, 25, 50];

function clockOf(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function FocusPanel({
  state,
  multiplier,
  busy,
  pledge,
  onPledgeChange,
  onStart,
  onStop,
}: {
  state: FocusState;
  multiplier: number;
  busy: boolean;
  pledge: number;
  onPledgeChange: (minutes: number) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const penalised = state.distractions.filter((d) => d.durationMs >= 5_000).length;

  return (
    <View style={styles.wrap}>
      {state.running && (
        <View style={styles.liveCard}>
          <View>
            <Text style={styles.liveLabel}>{state.away ? "FOCUS PAUSED" : "VERIFIED FOCUS"}</Text>
            <Text style={styles.clock}>{formatDuration(state.focusedMs)}</Text>
          </View>
          <View style={styles.liveStats}>
            <Text style={styles.stat}>{formatDuration(state.distractedMs)} away</Text>
            <Text style={styles.stat}>{penalised} breaks · {multiplier}x</Text>
          </View>
        </View>
      )}

      {!state.running && (
        <View style={styles.pledgeRow}>
          {PLEDGES.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => onPledgeChange(minutes)}
              style={({ pressed }) => [
                styles.pledgeChip,
                pledge === minutes && styles.pledgeChipOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pledgeText, pledge === minutes && styles.pledgeTextOn]}>
                {minutes === 0 ? "Open" : `${minutes}m`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!state.running && pledge > 0 && (
        <Text style={styles.pledgeNote}>
          Stop before the time is up, or admit you were distracted, and this session earns
          nothing. Stepping away for something real doesn&apos;t count against you.
        </Text>
      )}

      {state.running && state.pledgeMinutes > 0 && (
        <Text style={styles.pledgeNote}>
          {state.away
            ? "Away — your pledge runs on the clock, not your screen."
            : `Pledged ${state.pledgeMinutes} minutes${
                state.endsAt ? ` — done at ${clockOf(state.endsAt)}` : ""
              }.`}
        </Text>
      )}

      <Pressable
        onPress={state.running ? onStop : onStart}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          state.running && styles.stopButton,
          (pressed || busy) && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {busy ? "Syncing…" : state.running ? "End Focus Session" : "Start Focus Session"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  liveCard: {
    minHeight: 82,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 11, letterSpacing: 0.9 },
  clock: { color: colors.text, fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  liveStats: { alignItems: "flex-end", gap: 4 },
  pledgeRow: { flexDirection: "row", gap: 8 },
  pledgeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pledgeChipOn: { backgroundColor: colors.accentPale, borderColor: colors.accent },
  pledgeText: { color: colors.muted, fontFamily: roundedFont, fontSize: 15, fontWeight: "700" },
  pledgeTextOn: { color: colors.text },
  pledgeNote: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  stat: { color: colors.muted, fontFamily: roundedFont, fontSize: 12 },
  button: {
    minHeight: 66,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  stopButton: { backgroundColor: colors.bad },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  buttonText: {
    color: colors.surface,
    fontFamily: roundedFont,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
