import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Leaderboard } from "../api";
import { USER_ID } from "../config";
import { Pig, type PigColor } from "../components/Pig";
import { colors, roundedFont } from "../theme";

/** Rotates coats so the board reads as different pigs, not one repeated. */
const COATS: PigColor[] = ["pink", "purple", "blue"];


export function RanksScreen({
  leaderboard,
  refreshing,
  onRefresh,
}: {
  leaderboard: Leaderboard | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const entries = leaderboard?.entries ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
    >
      <Text style={styles.pageTitle}>Leaderboard</Text>
      <Text style={styles.subtitle}>Points this week</Text>

      {entries.length === 0 && (
        <Text style={styles.empty}>
          Nobody on the board yet. Points come from completed tasks and encouragements.
        </Text>
      )}

      <View style={styles.board}>
        {entries.map((entry, index) => (
          <View
            key={entry.userId}
            style={[
              styles.row,
              entry.userId === USER_ID && styles.youRow,
              index < entries.length - 1 && styles.divider,
            ]}
          >
            <Text style={[styles.rank, entry.rank === 1 && styles.first]}>{entry.rank}</Text>
            <Pig mood="happy" level={Math.min(9, 1 + entry.rank)} size={40} color={COATS[entry.rank % 3]} />
            <View style={styles.person}>
              <Text style={styles.name}>
                {entry.userId === USER_ID ? "You" : entry.displayName}
              </Text>
              <Text style={styles.streak}>
                {entry.tasksCompleted ?? 0} tasks · {entry.encouragementsReceived ?? 0} cheers
              </Text>
            </View>
            <View style={styles.minutesRow}>
              <Text style={styles.minutes}>{entry.points}</Text>
              <Text style={styles.unit}>pts</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 34 },
  empty: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
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
