import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Companion } from "../api";
import { Sprout } from "../components/Sprout";
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
          <View style={styles.legend}>
            <Legend color={colors.accent} label="Focused" />
            <Legend color={colors.sand} label="Distracted" />
          </View>
        </View>
        <View style={styles.chart}>
          {WEEK.map((entry) => (
            <View key={entry.day} style={styles.dayColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.distractedBar, { height: entry.distracted }]} />
                <View style={[styles.focusBar, { height: entry.focus }]} />
              </View>
              <Text style={styles.dayLabel}>{entry.day}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.cardTitle}>Growth timeline</Text>
        <View style={styles.timeline}>
          <GrowthPoint label="Week 1" stage={1} />
          <GrowthPoint label="Week 4" stage={2} />
          <GrowthPoint label="Now" stage={3} />
        </View>
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

function GrowthPoint({ label, stage }: { label: string; stage: 1 | 2 | 3 }) {
  return (
    <View style={styles.growthPoint}>
      <Sprout size={46} stage={stage} />
      <Text style={styles.growthLabel}>{label}</Text>
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
    minHeight: 236,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  legend: { flexDirection: "row", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 11, fontWeight: "700" },
  chart: { height: 164, flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 17 },
  dayColumn: { flex: 1, alignItems: "center", gap: 8 },
  barTrack: { height: 130, width: "100%", justifyContent: "flex-end", borderRadius: 7, overflow: "hidden" },
  distractedBar: { width: "100%", backgroundColor: colors.sand },
  focusBar: { width: "100%", backgroundColor: "#62b17a" },
  dayLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 12, fontWeight: "700" },
  timelineCard: {
    minHeight: 154,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  timeline: { flexDirection: "row", justifyContent: "space-around", marginTop: 16 },
  growthPoint: { alignItems: "center", gap: 5 },
  growthLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 13, fontWeight: "700" },
});
