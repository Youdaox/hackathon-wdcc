import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { AwayReason } from "../api";
import type { PendingCheckpoint } from "../useFocusSession";
import { Pig } from "../components/Pig";
import { colors, roundedFont } from "../theme";

/**
 * The return check-in — the core mechanic.
 *
 * Three deliberate choices:
 *
 * 1. **The pet asks, not the app.** "I got a little worried" lands differently
 *    from "You were distracted for 2 minutes". Same fact, and only one of them
 *    makes someone want to keep the app installed.
 *
 * 2. **Guess before reveal.** People are consistently bad at estimating time
 *    away, and the gap between their guess and the truth does more work than
 *    the number alone. Showing the real figure first throws that away, so the
 *    guess step is not skippable.
 *
 * 3. **Reasons have different consequences.** If every answer cost the same,
 *    asking would be theatre. Emergencies and real task-switching cost
 *    nothing; only self-reported drift touches HP.
 */

const GUESSES = [
  { label: "under 30s", seconds: 20 },
  { label: "about a minute", seconds: 60 },
  { label: "2–3 minutes", seconds: 150 },
  { label: "5 minutes+", seconds: 330 },
];

const REASONS: {
  reason: AwayReason;
  label: string;
  blurb: string;
  tone: "calm" | "neutral" | "cost" | "end";
}[] = [
  {
    reason: "emergency",
    label: "Something urgent",
    blurb: "No penalty — life happens.",
    tone: "calm",
  },
  {
    reason: "task",
    label: "Needed it for this task",
    blurb: "Logged for your recap, no penalty.",
    tone: "neutral",
  },
  {
    reason: "offline",
    label: "Phone was down",
    blurb: "Studying off-screen. No penalty.",
    tone: "calm",
  },
  {
    reason: "distraction",
    label: "I got distracted",
    blurb: "Costs a little HP. Honest is better.",
    tone: "cost",
  },
  { reason: "ended", label: "I'm done for now", blurb: "Ends the session.", tone: "end" },
];

function formatAway(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes}m ${rest}s`;
}

export function CheckpointScreen({
  pending,
  petName,
  onResolve,
}: {
  pending: PendingCheckpoint | null;
  petName: string;
  onResolve: (reason: AwayReason, guessedSeconds: number | null) => void;
}) {
  const [guess, setGuess] = useState<number | null>(null);

  if (!pending) return null;

  const actual = pending.durationMs;
  const revealed = guess !== null;
  // Positive means they under-estimated, which is the common case and the
  // more interesting one to name out loud.
  const gapSeconds = revealed ? Math.round(actual / 1000) - guess : 0;

  const handleResolve = (reason: AwayReason) => {
    onResolve(reason, guess);
    setGuess(null);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pig mood="sad" level={4} size={104} />

          {!revealed ? (
            <>
              <Text style={styles.title}>You slipped away for a bit</Text>
              <Text style={styles.body}>
                Before I tell you — how long do you think you were gone?
              </Text>

              <View style={styles.options}>
                {GUESSES.map((option) => (
                  <Pressable
                    key={option.label}
                    onPress={() => setGuess(option.seconds)}
                    style={({ pressed }) => [styles.guessButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.guessText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>It was {formatAway(actual)}</Text>
              <Text style={styles.body}>
                {gapSeconds > 30
                  ? `Longer than you thought — about ${formatAway(gapSeconds * 1000)} more. That's normal, and it's the bit worth noticing.`
                  : gapSeconds < -30
                    ? "Shorter than you thought, actually. You're keeping better track than most."
                    : "Just about what you guessed. Good instincts."}
              </Text>

              <Text style={styles.prompt}>What happened?</Text>
              <View style={styles.options}>
                {REASONS.map((option) => (
                  <Pressable
                    key={option.reason}
                    onPress={() => handleResolve(option.reason)}
                    style={({ pressed }) => [
                      styles.reasonButton,
                      option.tone === "cost" && styles.reasonCost,
                      option.tone === "end" && styles.reasonEnd,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.reasonLabel}>{option.label}</Text>
                    <Text style={styles.reasonBlurb}>{option.blurb}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.footnote}>
                {petName} keeps this for your weekly recap. Nothing is shared.
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 28, paddingTop: 64, alignItems: "center", gap: 4 },
  title: {
    color: colors.text,
    fontFamily: roundedFont,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },
  body: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 320,
  },
  prompt: {
    color: colors.text,
    fontFamily: roundedFont,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 28,
  },
  options: { alignSelf: "stretch", gap: 10, marginTop: 18 },
  guessButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  guessText: { color: colors.text, fontFamily: roundedFont, fontSize: 17, fontWeight: "700" },
  reasonButton: {
    minHeight: 68,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: "center",
    gap: 3,
  },
  reasonCost: { borderColor: "#f3cbb5", backgroundColor: "#fff5e9" },
  reasonEnd: { backgroundColor: colors.surfaceAlt },
  reasonLabel: { color: colors.text, fontFamily: roundedFont, fontSize: 17, fontWeight: "800" },
  reasonBlurb: { color: colors.muted, fontFamily: roundedFont, fontSize: 13 },
  pressed: { opacity: 0.7 },
  footnote: {
    color: colors.nav,
    fontFamily: roundedFont,
    fontSize: 12,
    textAlign: "center",
    marginTop: 22,
  },
});
