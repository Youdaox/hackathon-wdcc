import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Pig, type PigColor } from "../components/Pig";

/** Rotates coats so the leaderboard reads as different pigs, not one repeated. */
const COATS: PigColor[] = ["pink", "purple", "blue"];
import { colors, roundedFont } from "../theme";

const RANKS = [
  { rank: 1, name: "Priya N.", streak: 11, minutes: 301, stage: 3 as const, flower: true, emotion: "excited" as const },
  { rank: 2, name: "Marcus T.", streak: 8, minutes: 260, stage: 2 as const, emotion: "calm" as const },
  { rank: 3, name: "You", streak: 6, minutes: 243, stage: 2 as const, you: true, emotion: "happy" as const },
  { rank: 4, name: "Sofia R.", streak: 3, minutes: 150, stage: 1 as const, emotion: "sad" as const },
  { rank: 5, name: "Devon K.", streak: 2, minutes: 120, stage: 2 as const, emotion: "angry" as const },
];

export function RanksScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Leaderboard</Text>
      <Text style={styles.subtitle}>Verified minutes this week · COMPSCI 316 group</Text>

      <View style={styles.board}>
        {RANKS.map((entry, index) => (
          <View
            key={entry.rank}
            style={[
              styles.row,
              entry.you && styles.youRow,
              index < RANKS.length - 1 && styles.divider,
            ]}
          >
            <Text style={[styles.rank, entry.rank === 1 && styles.first]}>{entry.rank}</Text>
            <Pig mood="happy" level={entry.stage * 3} size={40} color={COATS[entry.rank % 3]} />
            <View style={styles.person}>
              <Text style={styles.name}>{entry.name}</Text>
              <Text style={styles.streak}>{entry.streak} day streak · {entry.emotion}</Text>
            </View>
            <View style={styles.minutesRow}>
              <Text style={styles.minutes}>{entry.minutes}</Text>
              <Text style={styles.unit}>min</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 34 },
  pageTitle: { color: colors.text, fontFamily: roundedFont, fontSize: 28, fontWeight: "900" },
  subtitle: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 22,
  },
  board: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: { height: 84, flexDirection: "row", alignItems: "center", paddingHorizontal: 18 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  youRow: { backgroundColor: colors.surfaceAlt },
  rank: { width: 28, color: colors.muted, fontFamily: roundedFont, fontSize: 17, fontWeight: "900" },
  first: { color: colors.peach },
  person: { flex: 1, marginLeft: 8, gap: 3 },
  name: { color: colors.text, fontFamily: roundedFont, fontSize: 17, fontWeight: "900" },
  streak: { color: colors.muted, fontFamily: roundedFont, fontSize: 13, fontWeight: "700" },
  minutesRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  minutes: { color: colors.text, fontFamily: roundedFont, fontSize: 18, fontWeight: "900" },
  unit: { color: colors.muted, fontFamily: roundedFont, fontSize: 11, fontWeight: "800" },
});
