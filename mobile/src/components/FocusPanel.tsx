import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FocusState } from "../useFocusSession";
import { colors, formatDuration } from "../theme";

/**
 * The timer and the honesty readout.
 *
 * Focused and distracted time are shown side by side during the session, not
 * revealed at the end. The whole mechanic depends on the user trusting the
 * number, and a number you can watch move is easier to trust than one that
 * appears afterward.
 */
export function FocusPanel({
  state,
  multiplier,
  busy,
  onStart,
  onStop,
}: {
  state: FocusState;
  multiplier: number;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const penalised = state.distractions.filter((d) => d.durationMs >= 5_000).length;

  return (
    <View style={styles.card}>
      <Text style={styles.clock}>{formatDuration(state.focusedMs)}</Text>
      <Text style={styles.clockLabel}>verified focus</Text>

      {state.running && (
        <View style={styles.stats}>
          <Stat label="Away" value={formatDuration(state.distractedMs)} />
          <Stat label="Breaks" value={String(penalised)} />
          <Stat label="Bonus" value={`${multiplier}x`} />
        </View>
      )}

      <Pressable
        onPress={state.running ? onStop : onStart}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          state.running ? styles.stopButton : styles.startButton,
          (pressed || busy) && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.buttonText, state.running && styles.stopText]}>
          {busy ? "Syncing…" : state.running ? "End session" : "Start focusing"}
        </Text>
      </Pressable>

      {state.running && (
        <Text style={styles.hint}>
          {state.away
            ? "You're away — this time isn't earning XP."
            : "Leave the app and the clock keeps running, but the time stops counting."}
        </Text>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    alignItems: "center",
    gap: 6,
  },
  clock: {
    color: colors.text,
    fontSize: 56,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
  },
  clockLabel: { color: colors.muted, fontSize: 13, letterSpacing: 0.4 },
  stats: { flexDirection: "row", gap: 28, marginTop: 14 },
  stat: { alignItems: "center", gap: 2 },
  statValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  statLabel: { color: colors.muted, fontSize: 11, textTransform: "uppercase" },
  button: {
    marginTop: 20,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignSelf: "stretch",
    alignItems: "center",
  },
  startButton: { backgroundColor: colors.accent },
  stopButton: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  buttonPressed: { opacity: 0.65 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: "700" },
  stopText: { color: colors.text },
  hint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 17,
  },
});
