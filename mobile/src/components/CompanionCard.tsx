import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Companion, PigAccessory, PigColor } from "../api";
import { PIG_ACCESSORIES, PIG_COLORS, Pig, STAGE_LABEL, stageForLevel } from "./Pig";
import { radius, roundedFont, useTheme } from "../theme";

/**
 * The companion card, matching the web layout: pig, name, growth stage, then
 * the XP and HP meters.
 *
 * Coat and accessory changes are pushed to the server rather than held here,
 * because the web reads the same row — a pig recoloured on the phone should be
 * the same pig in the browser.
 */
export function CompanionCard({
  companion,
  onCustomise,
}: {
  companion: Companion | null;
  onCustomise: (patch: { color?: PigColor; accessory?: PigAccessory }) => void;
}) {
  const { colors: c } = useTheme();

  if (!companion) {
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.loading, { color: c.muted }]}>Reaching your companion…</Text>
      </View>
    );
  }

  const xpPct = Math.min(100, (companion.xp / Math.max(1, companion.xp_needed)) * 100);
  const stage = stageForLevel(companion.level);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.stage, { color: c.faint }]}>
        {STAGE_LABEL[stage].toUpperCase()} · LEVEL {companion.level}
      </Text>

      <Pig
        mood={companion.mood}
        level={companion.level}
        color={companion.color}
        accessory={companion.accessory}
        hp={companion.hp}
        size={150}
      />

      <Text style={[styles.name, { color: c.ink }]}>{companion.name}</Text>

      <View style={styles.meters}>
        <Meter label="XP" value={`${companion.xp}/${companion.xp_needed}`} pct={xpPct} fill={c.moss} />
        <Meter
          label="HP"
          value={String(companion.hp)}
          pct={companion.hp}
          fill={companion.hp > 50 ? c.moss : companion.hp > 25 ? c.citrus : c.clay}
        />
      </View>

      <View style={styles.swatches}>
        {PIG_COLORS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityLabel={`${option.label} coat`}
            onPress={() => onCustomise({ color: option.value })}
            style={({ pressed }) => [
              styles.swatch,
              { backgroundColor: option.swatch, borderColor: c.line },
              companion.color === option.value && { borderColor: c.ink, borderWidth: 3 },
              pressed && styles.pressed,
            ]}
          />
        ))}
      </View>

      <View style={styles.accessories}>
        {PIG_ACCESSORIES.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => onCustomise({ accessory: option.value })}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: c.line, backgroundColor: c.surface2 },
              companion.accessory === option.value && { backgroundColor: c.moss, borderColor: c.moss },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: c.muted },
                companion.accessory === option.value && { color: c.surface },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Meter({
  label,
  value,
  pct,
  fill,
}: {
  label: string;
  value: string;
  pct: number;
  fill: string;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.meterRow}>
      <Text style={[styles.meterLabel, { color: c.faint }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: c.surface2 }]}>
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: fill }]} />
      </View>
      <Text style={[styles.meterValue, { color: c.muted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: "center",
    gap: 4,
  },
  loading: { fontFamily: roundedFont, fontSize: 15, paddingVertical: 40 },
  stage: {
    fontFamily: roundedFont,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  name: { fontFamily: roundedFont, fontSize: 24, fontWeight: "800", marginTop: 6 },
  meters: { alignSelf: "stretch", gap: 8, marginTop: 16 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  meterLabel: { fontFamily: roundedFont, fontSize: 11, fontWeight: "800", width: 22 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  meterValue: {
    fontFamily: roundedFont,
    fontSize: 12,
    width: 54,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  swatches: { flexDirection: "row", gap: 10, marginTop: 18 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1 },
  accessories: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: roundedFont, fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
