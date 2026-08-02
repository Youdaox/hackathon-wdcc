import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RecallState } from "../useRecallCheck";
import { radius, roundedFont, useTheme } from "../theme";

/**
 * The mid-session recall check, ported from the web component.
 *
 * A card rather than a modal on purpose: the session clock keeps running and
 * the whole thing is one tap to dismiss. Multiple choice rather than free text
 * because it grades instantly with no second model call, and answering costs
 * about two seconds.
 */
export function RecallCheck({
  state,
  onAnswer,
  onDismiss,
}: {
  state: RecallState;
  onAnswer: (index: number) => void;
  onDismiss: () => void;
}) {
  const { colors: c } = useTheme();
  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.meta, { color: c.faint }]}>QUICK RECALL</Text>
        <Text style={[styles.body, { color: c.muted }]}>Thinking of a question…</Text>
      </View>
    );
  }

  const { question } = state;
  const answered = state.status === "answered";

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.header}>
        <Text style={[styles.meta, { color: c.faint }]}>
          QUICK RECALL{question.source === "offline" ? " · OFFLINE" : ""}
        </Text>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Text style={[styles.dismiss, { color: c.faint }]}>Skip</Text>
        </Pressable>
      </View>

      <Text style={[styles.question, { color: c.ink }]}>{question.question}</Text>

      <View style={styles.options}>
        {question.options.map((option, index) => {
          const isCorrect = index === question.correctIndex;
          const isChosen = answered && state.chosen === index;
          // After answering, always reveal the right answer — being told you
          // were wrong without being told what's right teaches nothing.
          const tint = !answered
            ? undefined
            : isCorrect
              ? c.moss
              : isChosen
                ? c.clay
                : undefined;

          return (
            <Pressable
              key={option}
              disabled={answered}
              onPress={() => onAnswer(index)}
              style={({ pressed }) => [
                styles.option,
                { borderColor: tint ?? c.line, backgroundColor: c.surface2 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, { color: tint ?? c.ink }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      {answered && (
        <>
          <Text style={[styles.verdict, { color: state.correct ? c.moss : c.muted }]}>
            {state.correct ? "+10 XP" : "Not quite."}
          </Text>
          <Text style={[styles.body, { color: c.muted }]}>{question.explanation}</Text>
          <Pressable onPress={onDismiss} style={({ pressed }) => [pressed && styles.pressed]}>
            <Text style={[styles.dismiss, { color: c.moss, marginTop: 10 }]}>
              Back to focusing
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1, padding: 18, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontFamily: roundedFont, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  dismiss: { fontFamily: roundedFont, fontSize: 13, fontWeight: "700" },
  question: { fontFamily: roundedFont, fontSize: 17, fontWeight: "800", lineHeight: 24 },
  options: { gap: 8 },
  option: { minHeight: 48, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 14, justifyContent: "center" },
  optionText: { fontFamily: roundedFont, fontSize: 15, fontWeight: "600" },
  verdict: { fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  body: { fontFamily: roundedFont, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.7 },
});
