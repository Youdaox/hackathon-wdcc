import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Companion, StudySpot } from "../api";
import type { SpotMatch } from "../location";
import type { FocusState } from "../useFocusSession";
import { CompanionCard } from "../components/CompanionCard";
import { RecallCheck } from "../components/RecallCheck";
import { FocusPanel } from "../components/FocusPanel";
import { LocationCard } from "../components/LocationCard";
import { colors, roundedFont } from "../theme";

type HomeScreenProps = {
  companion: Companion | null;
  spots: StudySpot[];
  match: SpotMatch | null;
  checking: boolean;
  state: FocusState;
  multiplier: number;
  busy: boolean;
  pledge: number;
  recall: {
    state: import("../useRecallCheck").RecallState;
    answer: (index: number) => void;
    dismiss: () => void;
  };
  onCustomise: (patch: { color?: import("../api").PigColor; accessory?: import("../api").PigAccessory }) => void;
  onPledgeChange: (minutes: number) => void;
  notice: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onCheckIn: () => void;
  onStart: () => void;
  onStop: () => void;
};

export function HomeScreen(props: HomeScreenProps) {
  const date = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const focusedMinutes = Math.round((props.companion?.total_focused_ms ?? 42 * 60_000) / 60_000);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={colors.accent} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Incline</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Rare Coat</Text>
        </View>
      </View>

      <CompanionCard companion={props.companion} onCustomise={props.onCustomise} />

      <View style={styles.metricRow}>
        <MetricCard value={focusedMinutes} unit="min" label="Focused today" />
        <MetricCard value={6} unit="days" label="Current streak" />
      </View>

      <LocationCard
        spots={props.spots}
        match={props.match}
        checking={props.checking}
        onCheckIn={props.onCheckIn}
      />

      <RecallCheck
        state={props.recall.state}
        onAnswer={props.recall.answer}
        onDismiss={props.recall.dismiss}
      />

      <FocusPanel
        state={props.state}
        multiplier={props.multiplier}
        busy={props.busy}
        pledge={props.pledge}
        onPledgeChange={props.onPledgeChange}
        onStart={props.onStart}
        onStop={props.onStop}
      />

      {props.notice && <Text style={styles.notice}>{props.notice}</Text>}
    </ScrollView>
  );
}

function MetricCard({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 30, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  brand: { color: colors.text, fontFamily: roundedFont, fontSize: 29, fontWeight: "900", letterSpacing: -0.8 },
  date: { color: colors.muted, fontFamily: roundedFont, fontSize: 16, fontWeight: "600", marginTop: 5 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 15,
    height: 42,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.peach },
  badgeText: { color: colors.text, fontFamily: roundedFont, fontSize: 14, fontWeight: "800" },
  metricRow: { flexDirection: "row", gap: 12 },
  metric: {
    flex: 1,
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  metricValue: { color: colors.text, fontFamily: roundedFont, fontSize: 26, fontWeight: "900" },
  metricUnit: { color: colors.muted, fontFamily: roundedFont, fontSize: 13, fontWeight: "800" },
  metricLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 13, fontWeight: "700", marginTop: 6 },
  notice: { color: colors.muted, fontFamily: roundedFont, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
