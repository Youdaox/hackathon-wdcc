import { StyleSheet, Text, View } from "react-native";
import type { Companion } from "../api";
import { colors, roundedFont } from "../theme";
import { Sprout } from "./Sprout";

export function CompanionCard({ companion }: { companion: Companion | null }) {
  const name = companion?.name ?? "Fern";
  const stage = companion ? Math.min(3, Math.max(1, Math.ceil(companion.level / 3))) as 1 | 2 | 3 : 2;
  const happy = companion?.mood !== "sad" && companion?.mood !== "sick";

  return (
    <View style={styles.card}>
      <Text style={styles.stage}>{companion ? companion.species.toUpperCase() : "SAPLING"}</Text>
      <Sprout size={132} stage={stage} happy={happy} bubbles />
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.message}>
        {companion
          ? `${name} is glowing after today's sessions. Keep it up.`
          : "Reaching your companion…"}
      </Text>
      <View style={styles.palette}>
        <View style={[styles.swatch, styles.selected, { backgroundColor: "#64b47c" }]} />
        <View style={[styles.swatch, { backgroundColor: "#8bcb9c" }]} />
        <View style={[styles.swatch, { backgroundColor: "#96a59f" }]} />
        <View style={[styles.swatch, { backgroundColor: "#b8c2be" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 344,
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
  },
  stage: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  name: {
    color: colors.text,
    fontFamily: roundedFont,
    fontSize: 23,
    fontWeight: "800",
    marginTop: 8,
  },
  message: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 310,
    marginTop: 12,
  },
  palette: { flexDirection: "row", gap: 10, marginTop: 18 },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  selected: { borderWidth: 2, borderColor: colors.text },
});
