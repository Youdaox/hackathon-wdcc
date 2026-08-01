import { StyleSheet, Text, View } from "react-native";
import type { Companion } from "../api";
import { MOOD_LABEL, colors, faceFor, moodColor } from "../theme";

/**
 * The pet. Everything shown here comes from the server — the app never
 * computes growth locally, so three devices can't disagree about one creature.
 */
export function CompanionCard({ companion }: { companion: Companion | null }) {
  if (!companion) {
    return (
      <View style={styles.card}>
        <Text style={styles.loading}>Reaching your companion…</Text>
      </View>
    );
  }

  const xpPct = Math.min(100, (companion.xp / Math.max(1, companion.xp_needed)) * 100);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.face}>{faceFor(companion.mood, companion.level)}</Text>
        <View style={styles.info}>
          <Text style={styles.name}>{companion.name}</Text>
          <Text style={[styles.mood, { color: moodColor(companion.mood) }]}>
            Level {companion.level} · {MOOD_LABEL[companion.mood]}
          </Text>
        </View>
      </View>

      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>XP</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${xpPct}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text style={styles.meterValue}>
          {companion.xp}/{companion.xp_needed}
        </Text>
      </View>

      <View style={styles.meterRow}>
        <Text style={styles.meterLabel}>HP</Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${companion.hp}%`, backgroundColor: moodColor(companion.mood) },
            ]}
          />
        </View>
        <Text style={styles.meterValue}>{companion.hp}</Text>
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
    gap: 14,
  },
  loading: { color: colors.muted, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  face: { fontSize: 52 },
  info: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 22, fontWeight: "600" },
  mood: { fontSize: 14, fontWeight: "500" },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  meterLabel: { color: colors.muted, fontSize: 12, width: 22, fontWeight: "600" },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
  meterValue: { color: colors.muted, fontSize: 12, width: 54, textAlign: "right" },
});
