import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { StudySpot } from "../api";
import { type SpotMatch, formatDistance } from "../location";
import { colors } from "../theme";

/**
 * Study-spot check-in.
 *
 * Nothing here prompts for location until the user taps — the permission
 * dialog is never the first thing the app does. A denied or failed reading
 * leaves the session at 1x rather than showing an error, because location is
 * a bonus and must never look like a blocker.
 */
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
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Study spots</Text>
        <Pressable onPress={onCheckIn} disabled={checking} hitSlop={8}>
          {checking ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.action}>{match ? "Recheck" : "Check in"}</Text>
          )}
        </Pressable>
      </View>

      {match ? (
        <Text style={styles.status}>
          {match.inside ? (
            <>
              At <Text style={styles.strong}>{match.spot.name}</Text> —{" "}
              <Text style={styles.bonus}>{match.spot.multiplier}x XP</Text>
            </>
          ) : (
            <>
              {formatDistance(match.distanceM)} from {match.spot.name} — no bonus
            </>
          )}
        </Text>
      ) : (
        <Text style={styles.status}>
          Not checked in. Sessions still count, just at 1x.
        </Text>
      )}

      <View style={styles.list}>
        {spots.map((spot) => (
          <View key={spot.name} style={styles.spotRow}>
            <Text style={styles.spotName} numberOfLines={1}>
              {spot.name}
            </Text>
            <Text style={styles.spotMult}>{spot.multiplier}x</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
  action: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  status: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  strong: { color: colors.text, fontWeight: "600" },
  bonus: { color: colors.accent, fontWeight: "700" },
  list: { gap: 6, marginTop: 4 },
  spotRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  spotName: { color: colors.muted, fontSize: 13, flex: 1 },
  spotMult: { color: colors.muted, fontSize: 13, fontVariant: ["tabular-nums"] },
});
