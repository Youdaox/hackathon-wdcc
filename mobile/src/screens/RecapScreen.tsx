import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Companion, Recap } from "../api";
import { colors, roundedFont } from "../theme";

const GOAL_DAYS = 5;

const REASON_COPY: Record<string, string> = {
  emergency: "something urgent",
  task: "needed for the task",
  distraction: "plain distraction",
};

export function RecapScreen({
  companion,
  recap,
  refreshing,
  onRefresh,
}: {
  companion: Companion | null;
  recap: Recap | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const name = companion?.name ?? "Fern";
  const week = recap?.days ?? [];
  const totalFocused = recap?.total_focused_minutes ?? 0;
  const totalDistracted = recap?.total_distracted_minutes ?? 0;
  const denominator = totalFocused + totalDistracted;
  const averageFocus = denominator === 0 ? 0 : Math.round((totalFocused / denominator) * 100);
  const studyDays = recap?.study_days ?? 0;

  // The pattern line is the diagnostic payoff: a reason someone leaned on
  // repeatedly is worth naming, and it can't be read off a duration chart.
  const topReason = recap
    ? (Object.entries(recap.reasons) as [string, number][])
        .filter(([key]) => key !== "ended")
        .sort((a, b) => b[1] - a[1])[0]
    : undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />
      }
    >
      <Text style={styles.pageTitle}>Your week</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>This week, honestly</Text>
        <Text style={styles.summaryText}>
          {denominator === 0
            ? `No sessions logged yet. Start one and ${name} will keep track.`
            : `${totalFocused} verified minutes in the bank, ${totalDistracted} spent away. That's normal — the point is knowing.`}
        </Text>
        {recap?.guess_gap_seconds != null && recap.guess_gap_seconds > 10 && (
          <Text style={styles.summaryText}>
            You underestimate your time away by about {Math.round(recap.guess_gap_seconds)}s each
            time.
          </Text>
        )}
        {topReason && topReason[1] > 0 && (
          <Text style={styles.summaryText}>
            Most common reason: {REASON_COPY[topReason[0]] ?? topReason[0]} ({topReason[1]}x).
          </Text>
        )}
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.cardTitle}>Focus vs. distracted</Text>
          <View style={styles.averageBadge}>
            <Text style={styles.averageValue}>{averageFocus}%</Text>
            <Text style={styles.averageLabel}>weekly average</Text>
          </View>
        </View>
        <View style={styles.legend}>
          <Legend color={colors.accent} label="Focused" />
          <Legend color={colors.sand} label="Distracted" />
        </View>
        <View style={styles.chart}>
          {week.map((entry) => {
            const total = entry.focused_minutes + entry.distracted_minutes;
            // A day with no data reads as an empty column rather than
            // vanishing, so the week always has seven bars.
            const focusPct = total === 0 ? 0 : Math.round((entry.focused_minutes / total) * 100);
            const distractedPct = total === 0 ? 0 : 100 - focusPct;
            return (
              <View key={entry.date} style={styles.dayColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.distractedBar, { flex: distractedPct }]}>
                    <Text style={styles.distractedPercent}>{distractedPct}%</Text>
                  </View>
                  <View style={[styles.focusBar, { flex: focusPct }]}>
                    <Text style={styles.focusPercent}>{focusPct}%</Text>
                  </View>
                </View>
                <Text style={styles.dayLabel}>{entry.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View>
            <Text style={styles.cardTitle}>Weekly focus goal</Text>
            <Text style={styles.goalCount}>{studyDays} of 7 study days</Text>
          </View>
          <View style={styles.targetIcon}>
            <View style={styles.targetMiddle}>
              <View style={styles.targetCenter} />
            </View>
          </View>
        </View>
        <View style={styles.goalSegments}>
          {Array.from({ length: 7 }, (_, index) => (
            <View
              key={index}
              style={[styles.goalSegment, index < studyDays && styles.goalSegmentDone]}
            />
          ))}
        </View>
        <Text style={styles.goalMessage}>
          {studyDays >= GOAL_DAYS
            ? `Goal met — ${studyDays} study days, ${recap?.streak ?? 0} in a row.`
            : `${GOAL_DAYS - studyDays} more focused ${GOAL_DAYS - studyDays === 1 ? "day" : "days"} to complete your goal.`}
        </Text>
      </View>
    </ScrollView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32, gap: 20 },
  pageTitle: { color: colors.text, fontFamily: roundedFont, fontSize: 28, fontWeight: "900", marginBottom: 6 },
  cardTitle: { color: colors.text, fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  summaryCard: {
    minHeight: 104,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 7,
  },
  summaryText: { color: colors.muted, fontFamily: roundedFont, fontSize: 15, lineHeight: 23, fontWeight: "600" },
  chartCard: {
    minHeight: 268,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  averageBadge: { alignItems: "flex-end" },
  averageValue: { color: colors.accent, fontFamily: roundedFont, fontSize: 20, fontWeight: "900" },
  averageLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 9, fontWeight: "700" },
  legend: { flexDirection: "row", gap: 14, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 11, fontWeight: "700" },
  chart: { height: 164, flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 13 },
  dayColumn: { flex: 1, alignItems: "center", gap: 8 },
  barTrack: { height: 130, width: "100%", justifyContent: "flex-end", borderRadius: 7, overflow: "hidden" },
  distractedBar: { width: "100%", minHeight: 12, backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  focusBar: { width: "100%", backgroundColor: "#62b17a", alignItems: "center", justifyContent: "center" },
  distractedPercent: { color: "#746b5b", fontFamily: roundedFont, fontSize: 9, fontWeight: "800" },
  focusPercent: { color: colors.surface, fontFamily: roundedFont, fontSize: 10, fontWeight: "900" },
  dayLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 12, fontWeight: "700" },
  goalCard: {
    minHeight: 164,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  goalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalCount: { color: colors.accent, fontFamily: roundedFont, fontSize: 18, fontWeight: "900", marginTop: 5 },
  targetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 4,
    borderColor: colors.accentPale,
    alignItems: "center",
    justifyContent: "center",
  },
  targetMiddle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  targetCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  goalSegments: { flexDirection: "row", gap: 6, marginTop: 18 },
  goalSegment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#e8e2d5" },
  goalSegmentDone: { backgroundColor: colors.accent },
  goalMessage: { color: colors.muted, fontFamily: roundedFont, fontSize: 13, lineHeight: 19, fontWeight: "600", marginTop: 13 },
});
