import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { StudyBlock, StudySpot } from "../api";
import type { SpotMatch } from "../location";
import { colors, roundedFont } from "../theme";

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
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconTile}>
        {checking ? (
          <ActivityIndicator size="small" color={colors.peach} />
        ) : (
          <View style={styles.calendarGlyph} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {upcoming ? upcoming.block.title : "No study block scheduled"}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {match?.inside
            ? `${match.spot.multiplier}x check-in ready`
            : upcoming
              ? whenLabel(upcoming.inMinutes)
              : "Add one in Schedule"}{" "}
          · {place}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 66,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f3cbb5",
    backgroundColor: "#fff5e9",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  pressed: { opacity: 0.7 },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.peachPale,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarGlyph: { width: 18, height: 17, borderRadius: 4, backgroundColor: colors.peach },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.text, fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  subtitle: { color: colors.muted, fontFamily: roundedFont, fontSize: 14, fontWeight: "600" },
});
