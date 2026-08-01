import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Companion } from "../api";
import { colors, roundedFont } from "../theme";

const WEEK = [
  { day: "Wed", focus: 76, distracted: 24 },
  { day: "Thu", focus: 92, distracted: 10 },
  { day: "Fri", focus: 44, distracted: 50 },
  { day: "Sat", focus: 20, distracted: 16 },
  { day: "Sun", focus: 56, distracted: 20 },
  { day: "Mon", focus: 82, distracted: 12 },
  { day: "Tue", focus: 65, distracted: 35 },
];

export function RecapScreen({ companion }: { companion: Companion | null }) {
  const name = companion?.name ?? "Fern";
  const focusedMinutes = Math.round((companion?.total_focused_ms ?? 42 * 60_000) / 60_000);
  const totalFocused = WEEK.reduce((total, day) => total + day.focus, 0);
  const totalDistracted = WEEK.reduce((total, day) => total + day.distracted, 0);
  const averageFocus = Math.round((totalFocused / (totalFocused + totalDistracted)) * 100);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>Your week</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>Today, honestly</Text>
        <Text style={styles.summaryText}>
          {name} drifted for about 0 minutes today — totally normal. {focusedMinutes} verified minutes still went in the bank.
        </Text>
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
          {WEEK.map((entry) => {
            const total = entry.focus + entry.distracted;
            const focusPct = Math.round((entry.focus / total) * 100);
            const distractedPct = 100 - focusPct;
            return (
              <View key={entry.day} style={styles.dayColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.distractedBar, { flex: distractedPct }]}>
                    <Text style={styles.distractedPercent}>{distractedPct}%</Text>
                  </View>
                  <View style={[styles.focusBar, { flex: focusPct }]}>
                    <Text style={styles.focusPercent}>{focusPct}%</Text>
                  </View>
                </View>
                <Text style={styles.dayLabel}>{entry.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View>
            <Text style={styles.cardTitle}>Weekly focus goal</Text>
            <Text style={styles.goalCount}>5 of 7 study days</Text>
          </View>
          <View style={styles.targetIcon}>
            <View style={styles.targetMiddle}>
              <View style={styles.targetCenter} />
            </View>
          </View>
        </View>
        <View style={styles.goalSegments}>
          {Array.from({ length: 7 }, (_, index) => (
            <View key={index} style={[styles.goalSegment, index < 5 && styles.goalSegmentDone]} />
          ))}
        </View>
        <Text style={styles.goalMessage}>Two more focused days to complete your goal. You’re nearly there.</Text>
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
