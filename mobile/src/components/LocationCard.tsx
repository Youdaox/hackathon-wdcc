import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { StudyBlock, StudySpot } from "../api";
import type { SpotMatch } from "../location";
import { radius, roundedFont, useTheme } from "../theme";

/** The next-session card doubles as the explicit, user-triggered location check-in. */
const DAY_MIN = 1440;

/**
 * The next study block from the user's own schedule, or null if they have none.
 *
 * Blocks recur weekly, so "next" means the smallest positive gap from now
 * across every (day, start) pair, wrapping past the end of the week.
 */
function nextBlock(blocks: StudyBlock[]): { block: StudyBlock; inMinutes: number } | null {
  const now = new Date();
  const nowMin = now.getDay() * DAY_MIN + now.getHours() * 60 + now.getMinutes();
  let best: { block: StudyBlock; inMinutes: number } | null = null;

  for (const block of blocks) {
    for (const day of block.days) {
      const at = day * DAY_MIN + block.start_min;
      const gap = (at - nowMin + 7 * DAY_MIN) % (7 * DAY_MIN);
      if (!best || gap < best.inMinutes) best = { block, inMinutes: gap };
    }
  }
  return best;
}

function whenLabel(minutes: number): string {
  if (minutes < 1) return "starting now";
  if (minutes < 60) return `starts in ${Math.round(minutes)} min`;
  if (minutes < DAY_MIN) return `starts in ${Math.round(minutes / 60)}h`;
  return `in ${Math.round(minutes / DAY_MIN)}d`;
}

export function LocationCard({
  spots,
  blocks,
  match,
  checking,
  onCheckIn,
}: {
  spots: StudySpot[];
  blocks: StudyBlock[];
  match: SpotMatch | null;
  checking: boolean;
  onCheckIn: () => void;
}) {
  const { colors: c } = useTheme();
  const upcoming = nextBlock(blocks);
  const defaultSpot = spots.find((spot) => /kate/i.test(spot.name)) ?? spots[0];
  const place = match?.inside ? match.spot.name : defaultSpot?.name ?? "Kate Edger";

  return (
    <Pressable
      onPress={onCheckIn}
      disabled={checking}
      accessibilityLabel={
        upcoming ? `Check in to ${upcoming.block.title}` : "Check in to a study spot"
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surface, borderColor: c.line },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: c.amber }]} />
      <View style={[styles.iconTile, { backgroundColor: c.peachPale }]}>
        {checking ? (
          <ActivityIndicator size="small" color={c.amber} />
        ) : (
          <View style={[styles.calendarGlyph, { borderColor: c.amber }]}>
            <View style={[styles.calendarTop, { backgroundColor: c.amber }]} />
            <View style={styles.calendarDots}>
              <View style={[styles.calendarDot, { backgroundColor: c.amber }]} />
              <View style={[styles.calendarDot, { backgroundColor: c.amber }]} />
            </View>
          </View>
        )}
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>
            {upcoming ? upcoming.block.title : "No study block scheduled"}
          </Text>
          <View style={[styles.timePill, { backgroundColor: c.surface2 }]}>
            <Text style={[styles.timeText, { color: match?.inside ? c.moss : c.muted }]}>
              {match?.inside
                ? `${match.spot.multiplier}× READY`
                : upcoming
                  ? whenLabel(upcoming.inMinutes).toUpperCase()
                  : "OPEN"}
            </Text>
          </View>
        </View>
        <Text style={[styles.place, { color: c.faint }]} numberOfLines={1}>
          {upcoming?.block.course ? `${upcoming.block.course} · ` : ""}
          {place}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: c.faint }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 84,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  pressed: { opacity: 0.7 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarGlyph: { width: 22, height: 21, borderRadius: 5, borderWidth: 2, overflow: "hidden" },
  calendarTop: { height: 5, width: "100%" },
  calendarDots: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  calendarDot: { width: 3, height: 3, borderRadius: 2 },
  copy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { flex: 1, fontFamily: roundedFont, fontSize: 15, fontWeight: "900" },
  timePill: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  timeText: { fontFamily: roundedFont, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  place: { fontFamily: roundedFont, fontSize: 11, fontWeight: "700" },
  chevron: { fontFamily: roundedFont, fontSize: 26, fontWeight: "500", marginLeft: -3 },
});
