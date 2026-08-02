import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Companion, Recap } from "../api";
import type { PlantSessionSummary } from "../usePlantMode";
import { formatDuration, radius, roundedFont, useTheme } from "../theme";

const GOAL_DAYS = 5;

const REASON_COPY: Record<string, string> = {
  emergency: "something urgent",
  task: "needed for the task",
  offline: "studying offline",
  distraction: "plain distraction",
};

export function RecapScreen({
  companion,
  recap,
  plantSummary,
  refreshing,
  onRefresh,
}: {
  companion: Companion | null;
  recap: Recap | null;
  plantSummary: PlantSessionSummary | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { colors: c } = useTheme();
  const name = companion?.name ?? "Oinky";
  const week = recap?.days ?? [];
  const totalFocused = recap?.total_focused_minutes ?? 0;
  const totalDistracted = recap?.total_distracted_minutes ?? 0;
  const denominator = totalFocused + totalDistracted;
  const averageFocus = denominator === 0 ? 0 : Math.round((totalFocused / denominator) * 100);
  const studyDays = recap?.study_days ?? 0;
  const topReason = recap
    ? (Object.entries(recap.reasons) as [string, number][])
        .filter(([key]) => key !== "ended")
        .sort((a, b) => b[1] - a[1])[0]
    : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: c.canvas }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.moss} />
      }
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.eyebrow, { color: c.moss }]}>YOUR PROGRESS</Text>
        <Text style={[styles.pageTitle, { color: c.ink }]}>A week in focus</Text>
        <Text style={[styles.pageSubtitle, { color: c.muted }]}>Honest numbers, useful patterns.</Text>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={[styles.summaryIcon, { backgroundColor: c.accentPale }]}>
          <Text style={[styles.summaryIconText, { color: c.moss }]}>✦</Text>
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.cardTitle, { color: c.ink }]}>This week, honestly</Text>
          <Text style={[styles.summaryText, { color: c.muted }]}>
            {denominator === 0
              ? `No sessions yet. Start one and ${name} will keep track.`
              : `${totalFocused} verified minutes, with ${totalDistracted} minutes spent away.`}
          </Text>
          {recap?.guess_gap_seconds != null && recap.guess_gap_seconds > 10 && (
            <Text style={[styles.insightText, { color: c.amber }]}>
              You underestimate time away by about {Math.round(recap.guess_gap_seconds)}s.
            </Text>
          )}
          {topReason && topReason[1] > 0 && (
            <Text style={[styles.insightText, { color: c.faint }]}>
              Most common reason: {REASON_COPY[topReason[0]] ?? topReason[0]} · {topReason[1]}×
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.chartCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.cardEyebrow, { color: c.faint }]}>FOCUS QUALITY</Text>
            <Text style={[styles.cardTitleLarge, { color: c.ink }]}>Focus vs. distracted</Text>
          </View>
          <View style={[styles.averageBadge, { backgroundColor: c.accentPale }]}>
            <Text style={[styles.averageValue, { color: c.moss }]}>{averageFocus}%</Text>
            <Text style={[styles.averageLabel, { color: c.mossDeep }]}>AVERAGE</Text>
          </View>
        </View>

        <View style={styles.legend}>
          <Legend color={c.moss} label="Focused" />
          <Legend color={c.surface2} label="Distracted" outlined />
        </View>

        <View style={styles.chart}>
          {week.map((entry) => {
            const total = entry.focused_minutes + entry.distracted_minutes;
            const focusPct = total === 0 ? 0 : Math.round((entry.focused_minutes / total) * 100);
            const distractedPct = total === 0 ? 0 : 100 - focusPct;
            return (
              <View key={entry.date} style={styles.dayColumn}>
                <Text style={[styles.percentLabel, { color: focusPct > 0 ? c.moss : c.faint }]}>
                  {focusPct}%
                </Text>
                <View style={[styles.barTrack, { backgroundColor: c.surface2 }]}>
                  {total > 0 && (
                    <>
                      <View style={{ flex: distractedPct, backgroundColor: c.surface2 }} />
                      <View style={{ flex: focusPct, backgroundColor: c.moss }} />
                    </>
                  )}
                </View>
                <Text style={[styles.dayLabel, { color: c.faint }]}>{entry.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {plantSummary && (
        <View style={[styles.plantCard, { backgroundColor: c.accentPale, borderColor: c.moss }]}>
          <View style={styles.plantCardHeader}>
            <View>
              <Text style={[styles.cardEyebrow, { color: c.mossDeep }]}>PLANT-TO-FOCUS</Text>
              <Text style={[styles.cardTitleLarge, { color: c.ink }]}>Last planted session</Text>
            </View>
            <View style={[styles.plantedBadge, { backgroundColor: c.surface }]}>
              <Text style={[styles.plantedBadgeValue, { color: c.moss }]}>
                {plantSummary.plantedPercentage}%
              </Text>
              <Text style={[styles.plantedBadgeLabel, { color: c.faint }]}>PLANTED</Text>
            </View>
          </View>
          <View style={[styles.plantMetrics, { backgroundColor: c.surface }]}>
            <PlantMetric value={String(plantSummary.phonePickups)} label="Phone pickups" />
            <View style={[styles.metricDivider, { backgroundColor: c.line }]} />
            <PlantMetric value={formatDuration(plantSummary.longestPlantedMs)} label="Longest stretch" />
          </View>
        </View>
      )}

      <View style={[styles.goalCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.goalHeader}>
          <View>
            <Text style={[styles.cardEyebrow, { color: c.faint }]}>CONSISTENCY</Text>
            <Text style={[styles.cardTitleLarge, { color: c.ink }]}>Weekly focus goal</Text>
            <Text style={[styles.goalCount, { color: c.moss }]}>{studyDays} of 7 study days</Text>
          </View>
          <View style={[styles.targetIcon, { borderColor: c.accentPale }]}>
            <View style={[styles.targetMiddle, { borderColor: c.moss }]}>
              <View style={[styles.targetCenter, { backgroundColor: c.moss }]} />
            </View>
          </View>
        </View>
        <View style={styles.goalSegments}>
          {Array.from({ length: 7 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.goalSegment,
                { backgroundColor: index < studyDays ? c.moss : c.surface2 },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.goalMessage, { color: c.muted }]}>
          {studyDays >= GOAL_DAYS
            ? `Goal met — ${studyDays} study days, ${recap?.streak ?? 0} in a row.`
            : `${GOAL_DAYS - studyDays} more focused ${GOAL_DAYS - studyDays === 1 ? "day" : "days"} to complete your goal.`}
        </Text>
      </View>
    </ScrollView>
  );
}

function PlantMetric({ value, label }: { value: string; label: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.plantMetric}>
      <Text style={[styles.plantMetricValue, { color: c.ink }]}>{value}</Text>
      <Text style={[styles.plantMetricLabel, { color: c.faint }]}>{label}</Text>
    </View>
  );
}

function Legend({ color, label, outlined = false }: { color: string; label: string; outlined?: boolean }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }, outlined && { borderColor: c.line, borderWidth: 1 }]} />
      <Text style={[styles.legendLabel, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 38, gap: 15 },
  pageHeader: { marginBottom: 4 },
  eyebrow: { fontFamily: roundedFont, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  pageTitle: { fontFamily: roundedFont, fontSize: 30, fontWeight: "900", letterSpacing: -0.7, marginTop: 3 },
  pageSubtitle: { fontFamily: roundedFont, fontSize: 13, fontWeight: "600", marginTop: 3 },
  summaryCard: {
    minHeight: 112,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 17,
    flexDirection: "row",
    gap: 13,
  },
  summaryIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  summaryIconText: { fontFamily: roundedFont, fontSize: 19, fontWeight: "900" },
  summaryCopy: { flex: 1, gap: 5 },
  cardTitle: { fontFamily: roundedFont, fontSize: 16, fontWeight: "900" },
  cardTitleLarge: { fontFamily: roundedFont, fontSize: 18, fontWeight: "900", marginTop: 2 },
  cardEyebrow: { fontFamily: roundedFont, fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  summaryText: { fontFamily: roundedFont, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  insightText: { fontFamily: roundedFont, fontSize: 10, lineHeight: 15, fontWeight: "700" },
  chartCard: { minHeight: 274, borderRadius: radius.card, borderWidth: 1, padding: 17 },
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  averageBadge: { minWidth: 64, borderRadius: 15, paddingHorizontal: 9, paddingVertical: 7, alignItems: "center" },
  averageValue: { fontFamily: roundedFont, fontSize: 20, fontWeight: "900" },
  averageLabel: { fontFamily: roundedFont, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  legend: { flexDirection: "row", gap: 14, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendLabel: { fontFamily: roundedFont, fontSize: 10, fontWeight: "700" },
  chart: { height: 164, flexDirection: "row", alignItems: "flex-end", gap: 7, marginTop: 10 },
  dayColumn: { flex: 1, alignItems: "center", gap: 5 },
  percentLabel: { fontFamily: roundedFont, fontSize: 8, fontWeight: "900" },
  barTrack: { height: 124, width: "100%", borderRadius: 7, overflow: "hidden" },
  dayLabel: { fontFamily: roundedFont, fontSize: 10, fontWeight: "800" },
  plantCard: { minHeight: 164, borderRadius: radius.card, borderWidth: 1, padding: 17 },
  plantCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  plantedBadge: { borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7, alignItems: "center" },
  plantedBadgeValue: { fontFamily: roundedFont, fontSize: 19, fontWeight: "900" },
  plantedBadgeLabel: { fontFamily: roundedFont, fontSize: 7, fontWeight: "900", letterSpacing: 0.6 },
  plantMetrics: { flexDirection: "row", alignItems: "center", borderRadius: 17, marginTop: 17, paddingVertical: 12 },
  plantMetric: { flex: 1, alignItems: "center", gap: 3 },
  plantMetricValue: { fontFamily: roundedFont, fontSize: 18, fontWeight: "900" },
  plantMetricLabel: { fontFamily: roundedFont, fontSize: 9, fontWeight: "700" },
  metricDivider: { width: 1, height: 32 },
  goalCard: { minHeight: 174, borderRadius: radius.card, borderWidth: 1, padding: 17 },
  goalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalCount: { fontFamily: roundedFont, fontSize: 14, fontWeight: "900", marginTop: 5 },
  targetIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 5, alignItems: "center", justifyContent: "center" },
  targetMiddle: { width: 25, height: 25, borderRadius: 13, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  targetCenter: { width: 7, height: 7, borderRadius: 4 },
  goalSegments: { flexDirection: "row", gap: 5, marginTop: 18 },
  goalSegment: { flex: 1, height: 8, borderRadius: 4 },
  goalMessage: { fontFamily: roundedFont, fontSize: 12, lineHeight: 18, fontWeight: "600", marginTop: 13 },
});
