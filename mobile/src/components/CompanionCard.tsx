import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { Companion, PigAccessory, PigColor } from "../api";
import { PIG_ACCESSORIES, STAGE_LABEL, stageForLevel } from "./Pig";
import { AnimalSprite, SPECIES_COLORS, swatchFor } from "./AnimalSprite";
import { hpCostForAway } from "../config";
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
  awayMs = 0,
  onCustomise,
}: {
  companion: Companion | null;
  /** Time away during the running session, for the live HP prediction. */
  awayMs?: number;
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

  // Predicted, not authoritative: the server recomputes HP when the session
  // syncs. Floored at 0 so the meter can't invert on a long absence.
  const drained = Math.max(0, companion.hp - hpCostForAway(awayMs));
  const hp = Math.round(drained);
  const draining = awayMs > 0 && hp < companion.hp;

  const xpPct = Math.min(100, (companion.xp / Math.max(1, companion.xp_needed)) * 100);
  const stage = stageForLevel(companion.level);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.stage, { color: c.faint }]}>
        {STAGE_LABEL[stage].toUpperCase()} · LEVEL {companion.level}
      </Text>

      <BreathingSprite draining={draining}>
      <AnimalSprite
        species={companion.species}
        mood={hp <= 25 ? "sick" : hp <= 50 ? "sad" : companion.mood}
        level={companion.level}
        color={companion.color}
        hp={hp}
        size={150}
      />
      </BreathingSprite>

      <Text style={[styles.name, { color: c.ink }]}>{companion.name}</Text>

      <View style={styles.meters}>
        <Meter label="XP" value={`${companion.xp}/${companion.xp_needed}`} pct={xpPct} fill={c.moss} />
        <Meter
          label="HP"
          value={draining ? `${hp} ▾` : String(hp)}
          pct={hp}
          fill={hp > 50 ? c.moss : hp > 25 ? c.citrus : c.clay}
        />
      </View>

      <View style={styles.swatches}>
        {(SPECIES_COLORS[companion.species] ?? SPECIES_COLORS.pig).map((option) => (
          <Pressable
            key={option}
            accessibilityLabel={`${option} coat`}
            onPress={() => onCustomise({ color: option })}
            style={({ pressed }) => [
              styles.swatch,
              { backgroundColor: swatchFor(companion.species, option), borderColor: c.line },
              companion.color === option && { borderColor: c.ink, borderWidth: 3 },
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

/**
 * A meter whose fill animates between values.
 *
 * Worth the extra machinery: HP is the number the whole mechanic hangs on, and
 * a bar that slides makes a loss legible in a way a snapped-to-new-width bar
 * simply isn't.
 */
/**
 * A slow idle breath, tightening into an anxious flutter while HP drains, so
 * the companion reads as alive and visibly unhappy about being left.
 */
function BreathingSprite({
  draining,
  children,
}: {
  draining: boolean;
  children: React.ReactNode;
}) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: draining ? 380 : 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: draining ? 380 : 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, draining]);

  return (
    <Animated.View
      style={{
        transform: [
          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, draining ? 1.03 : 1.015] }) },
          { translateX: breath.interpolate({ inputRange: [0, 1], outputRange: [0, draining ? 2 : 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
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
  const width = useRef(new Animated.Value(Math.max(0, Math.min(100, pct)))).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(100, pct)),
      duration: 420,
      easing: Easing.out(Easing.cubic),
      // Width can't run on the native thread; the tradeoff is fine for a bar
      // that changes a few times a session.
      useNativeDriver: false,
    }).start();
  }, [pct, width]);

  return (
    <View style={styles.meterRow}>
      <Text style={[styles.meterLabel, { color: c.faint }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: c.surface2 }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: width.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: fill,
            },
          ]}
        />
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
