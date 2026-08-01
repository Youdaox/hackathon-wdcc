import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { StudySpot } from "../api";
import type { SpotMatch } from "../location";
import { colors, roundedFont } from "../theme";

/** The next-session card doubles as the explicit, user-triggered location check-in. */
export function LocationCard({
  spots,
  match,
  checking,
  onCheckIn,
}: {
  spots: StudySpot[];
  match: SpotMatch | null;
  checking: boolean;
  onCheckIn: () => void;
}) {
  const defaultSpot = spots.find((spot) => /kate/i.test(spot.name)) ?? spots[0];
  const place = match?.inside ? match.spot.name : defaultSpot?.name ?? "Kate Edger";

  return (
    <Pressable
      onPress={onCheckIn}
      disabled={checking}
      accessibilityLabel="Check in to the upcoming COMPSCI 316 study block"
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
        <Text style={styles.title}>COMPSCI 316 study block</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {match?.inside ? `${match.spot.multiplier}x check-in ready` : "Starts in 20 min"} · {place}
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
