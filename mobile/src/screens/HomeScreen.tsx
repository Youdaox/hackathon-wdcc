import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { AvatarEmotion, Companion, StudyBlock, StudySpot } from "../api";
import type { SpotMatch } from "../location";
import type { FocusState } from "../useFocusSession";
import { CompanionCard } from "../components/CompanionCard";
import { RecallCheck } from "../components/RecallCheck";
import { FocusPanel } from "../components/FocusPanel";
import { LocationCard } from "../components/LocationCard";
import { radius, roundedFont, useTheme } from "../theme";
import { NEW_ZEALAND_TIME_ZONE } from "../timezone";

type HomeScreenProps = {
  companion: Companion | null;
  spots: StudySpot[];
  blocks: StudyBlock[];
  match: SpotMatch | null;
  checking: boolean;
  state: FocusState;
  multiplier: number;
  busy: boolean;
  pledge: number;
  focusedTodayMinutes: number;
  streak: number;
  recall: {
    state: import("../useRecallCheck").RecallState;
    answer: (index: number) => void;
    dismiss: () => void;
  };
  onMoodChange: (emotion: AvatarEmotion) => void;
  onPledgeChange: (minutes: number) => void;
  notice: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onCheckIn: () => void;
  onStart: () => void;
  onStop: () => void;
};

export function HomeScreen(props: HomeScreenProps) {
  const { colors: c } = useTheme();
  const date = new Date().toLocaleDateString("en-NZ", {
    timeZone: NEW_ZEALAND_TIME_ZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <ScrollView
      style={{ backgroundColor: c.canvas }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={c.moss} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.todayRow}>
            <View style={[styles.todayDot, { backgroundColor: c.moss }]} />
            <Text style={[styles.todayLabel, { color: c.moss }]}>TODAY</Text>
          </View>
          <Text style={[styles.brand, { color: c.ink }]}>Incline</Text>
          <Text style={[styles.date, { color: c.muted }]}>{date}</Text>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.levelValue, { color: c.ink }]}>LV {props.companion?.level ?? "—"}</Text>
          <Text style={[styles.levelLabel, { color: c.faint }]}>COMPANION</Text>
        </View>
      </View>

      <CompanionCard
        companion={props.companion}
        awayMs={props.state.running ? props.state.distractedMs : 0}
        onMoodChange={props.onMoodChange}
      />

      <View style={styles.metricRow}>
        <MetricCard
          icon="◷"
          value={props.focusedTodayMinutes}
          unit="min"
          label="Focused today"
          accent={c.moss}
          soft={c.accentPale}
        />
        <MetricCard
          icon="✦"
          value={props.streak}
          unit={props.streak === 1 ? "day" : "days"}
          label="Current streak"
          accent={c.amber}
          soft={c.peachPale}
        />
      </View>

      <SectionHeading eyebrow="YOUR PLAN" title="Up next" />
      <LocationCard
        spots={props.spots}
        blocks={props.blocks}
        match={props.match}
        checking={props.checking}
        onCheckIn={props.onCheckIn}
      />

      <RecallCheck
        state={props.recall.state}
        onAnswer={props.recall.answer}
        onDismiss={props.recall.dismiss}
      />

      <SectionHeading eyebrow="DEEP WORK" title={props.state.running ? "Session in progress" : "Ready when you are"} />
      <FocusPanel
        state={props.state}
        multiplier={props.multiplier}
        busy={props.busy}
        pledge={props.pledge}
        onPledgeChange={props.onPledgeChange}
        onStart={props.onStart}
        onStop={props.onStop}
      />

      {props.notice && (
        <View style={[styles.noticeCard, { backgroundColor: c.surface2, borderColor: c.line }]}>
          <View style={[styles.noticeDot, { backgroundColor: c.amber }]} />
          <Text style={[styles.notice, { color: c.muted }]}>{props.notice}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionEyebrow, { color: c.moss }]}>{eyebrow}</Text>
      <Text style={[styles.sectionTitle, { color: c.ink }]}>{title}</Text>
    </View>
  );
}

function MetricCard({
  icon,
  value,
  unit,
  label,
  accent,
  soft,
}: {
  icon: string;
  value: number;
  unit: string;
  label: string;
  accent: string;
  soft: string;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={[styles.metricIcon, { backgroundColor: soft }]}>
        <Text style={[styles.metricIconText, { color: accent }]}>{icon}</Text>
      </View>
      <View style={styles.metricBody}>
        <View style={styles.metricValueRow}>
          <Text style={[styles.metricValue, { color: c.ink }]}>{value}</Text>
          <Text style={[styles.metricUnit, { color: c.muted }]}>{unit}</Text>
        </View>
        <Text style={[styles.metricLabel, { color: c.faint }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 38, gap: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  headerCopy: { gap: 2 },
  todayRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  todayDot: { width: 6, height: 6, borderRadius: 3 },
  todayLabel: { fontFamily: roundedFont, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  brand: { fontFamily: roundedFont, fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  date: { fontFamily: roundedFont, fontSize: 14, fontWeight: "600" },
  levelBadge: {
    minWidth: 84,
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  levelValue: { fontFamily: roundedFont, fontSize: 15, fontWeight: "900" },
  levelLabel: { fontFamily: roundedFont, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  metricRow: { flexDirection: "row", gap: 11 },
  metric: {
    flex: 1,
    minHeight: 84,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metricIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metricIconText: { fontFamily: roundedFont, fontSize: 18, fontWeight: "900" },
  metricBody: { flex: 1 },
  metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  metricValue: { fontFamily: roundedFont, fontSize: 23, fontWeight: "900" },
  metricUnit: { fontFamily: roundedFont, fontSize: 11, fontWeight: "800" },
  metricLabel: { fontFamily: roundedFont, fontSize: 10, fontWeight: "700", marginTop: 2 },
  sectionHeading: { marginTop: 5, gap: 1 },
  sectionEyebrow: { fontFamily: roundedFont, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  sectionTitle: { fontFamily: roundedFont, fontSize: 19, fontWeight: "900" },
  noticeCard: {
    minHeight: 50,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noticeDot: { width: 8, height: 8, borderRadius: 4 },
  notice: { flex: 1, fontFamily: roundedFont, fontSize: 12, lineHeight: 18, fontWeight: "600" },
});
