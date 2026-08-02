import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Pig } from "./Pig";
import { formatDuration, radius, roundedFont, useTheme } from "../theme";

export interface SessionOutcome {
  focusedMs: number;
  distractedMs: number;
  breaks: number;
  xpEarned: number;
  voided: boolean;
  voidReason: "left-early" | "distracted" | null;
  pledgeMinutes: number;
  locationName: string | null;
}

/**
 * The end-of-session card, ported from the web `SessionSummary`.
 *
 * It shows what was earned *and* what wasn't. Hiding the away time would make
 * the number meaningless — the mechanic only works if the honest figure is the
 * one on screen.
 */
export function SessionSummary({
  outcome,
  petName,
  onDismiss,
}: {
  outcome: SessionOutcome | null;
  petName: string;
  onDismiss: () => void;
}) {
  const { colors: c } = useTheme();
  if (!outcome) return null;

  const { voided, xpEarned } = outcome;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.root, { backgroundColor: c.canvas }]}>
        <Pig mood={voided ? "sad" : "happy"} level={voided ? 2 : 6} size={132} />

        <Text style={[styles.headline, { color: c.ink }]}>
          {voided ? "Nothing banked" : `+${xpEarned} XP`}
        </Text>

        <Text style={[styles.body, { color: c.muted }]}>
          {voided
            ? outcome.voidReason === "distracted"
              ? `You pledged ${outcome.pledgeMinutes} minutes and said you got distracted, so this one doesn't count. ${petName} isn't upset — the honesty is the point.`
              : `You stopped before the ${outcome.pledgeMinutes} minutes you pledged, so this one doesn't count.`
            : `${petName} grew on ${formatDuration(outcome.focusedMs)} of verified focus.`}
        </Text>

        <View style={[styles.stats, { borderColor: c.line, backgroundColor: c.surface }]}>
          <Stat label="Focused" value={formatDuration(outcome.focusedMs)} />
          <Stat label="Away" value={formatDuration(outcome.distractedMs)} />
          <Stat label="Breaks" value={String(outcome.breaks)} />
        </View>

        {outcome.locationName && (
          <Text style={[styles.note, { color: c.moss }]}>Bonus at {outcome.locationName}</Text>
        )}

        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.button, { backgroundColor: c.moss }, pressed && styles.dim]}
        >
          <Text style={[styles.buttonText, { color: c.surface }]}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: c.ink }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.faint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 6 },
  headline: { fontFamily: roundedFont, fontSize: 34, fontWeight: "900", marginTop: 16 },
  body: {
    fontFamily: roundedFont,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 8,
  },
  stats: {
    flexDirection: "row",
    alignSelf: "stretch",
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: 18,
    marginTop: 26,
    justifyContent: "space-around",
  },
  stat: { alignItems: "center", gap: 3 },
  statValue: {
    fontFamily: roundedFont,
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontFamily: roundedFont, fontSize: 11, letterSpacing: 0.8 },
  note: { fontFamily: roundedFont, fontSize: 14, fontWeight: "700", marginTop: 14 },
  button: {
    alignSelf: "stretch",
    minHeight: 54,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
  },
  buttonText: { fontFamily: roundedFont, fontSize: 17, fontWeight: "800" },
  dim: { opacity: 0.6 },
});
