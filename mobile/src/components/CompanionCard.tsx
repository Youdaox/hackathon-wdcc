import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { AvatarEmotion, Companion } from "../api";
import { hpCostForAway } from "../config";
import { radius, roundedFont, type Palette, useTheme } from "../theme";
import { AnimalSprite } from "./AnimalSprite";
import { type Mood, STAGE_LABEL, stageForLevel } from "./Pig";

const CHECK_INS: { emotion: AvatarEmotion; label: string; icon: string }[] = [
  { emotion: "happy", label: "Happy", icon: "☺" },
  { emotion: "sad", label: "Sad", icon: "☹" },
  { emotion: "angry", label: "Angry", icon: "♨" },
  { emotion: "calm", label: "Calm", icon: "~" },
  { emotion: "excited", label: "Excited", icon: "✦" },
];

const EMOTION_MOOD: Record<AvatarEmotion, Mood> = {
  happy: "happy",
  sad: "sad",
  angry: "sad",
  calm: "neutral",
  excited: "happy",
};

function emotionColor(emotion: AvatarEmotion | null, c: Palette): string {
  if (emotion === "sad") return c.amber;
  if (emotion === "angry") return c.clay;
  if (emotion === "calm") return c.citrus;
  if (emotion === "excited") return c.moss;
  return c.moss;
}

function formatFocus(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m focused together`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m focused together`;
}

/** The home hero: companion state, feeling check-in, and live growth. */
export function CompanionCard({
  companion,
  awayMs = 0,
  onMoodChange,
}: {
  companion: Companion | null;
  /** Time away during the running session, for the live HP prediction. */
  awayMs?: number;
  onMoodChange: (emotion: AvatarEmotion) => void;
}) {
  const { colors: c } = useTheme();

  if (!companion) {
    return (
      <View style={[styles.card, styles.loadingCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={[styles.loadingOrb, { backgroundColor: c.surface2 }]} />
        <Text style={[styles.loading, { color: c.muted }]}>Waking your companion…</Text>
      </View>
    );
  }

  const drained = Math.max(0, companion.hp - hpCostForAway(awayMs));
  const hp = Math.round(drained);
  const draining = awayMs > 0 && hp < companion.hp;
  const xpPct = Math.min(100, (companion.xp / Math.max(1, companion.xp_needed)) * 100);
  const stage = stageForLevel(companion.level);
  const emotion = companion.check_in_emotion;
  const selected = emotion ? CHECK_INS.find((item) => item.emotion === emotion) : null;
  const nextCheckIn = companion.next_check_in_at ? Date.parse(companion.next_check_in_at) : null;
  const checkInDue = nextCheckIn === null || !Number.isFinite(nextCheckIn) || nextCheckIn <= Date.now();
  const displayMood: Mood =
    hp <= 25 ? "sick" : hp <= 50 ? "sad" : emotion ? EMOTION_MOOD[emotion] : companion.mood;
  const accent = emotionColor(emotion, c);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.topRow}>
        <View style={[styles.stagePill, { backgroundColor: c.surface2 }]}>
          <Text style={[styles.stage, { color: c.faint }]}>
            {STAGE_LABEL[stage].toUpperCase()} · LV {companion.level}
          </Text>
        </View>
        <View style={[styles.healthPill, { backgroundColor: hp > 50 ? c.moss : c.clay }]}>
          <View style={[styles.healthDot, { backgroundColor: c.surface }]} />
          <Text style={[styles.healthText, { color: c.surface }]}>{hp} HP</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={[styles.haloOuter, { backgroundColor: `${accent}18` }]} />
        <View style={[styles.haloInner, { backgroundColor: `${accent}24` }]} />
        <BreathingSprite draining={draining}>
          <AnimalSprite
            species={companion.species}
            mood={displayMood}
            level={companion.level}
            color={companion.color}
            accessory={companion.accessory}
            hp={hp}
            size={164}
          />
        </BreathingSprite>
      </View>

      <Text style={[styles.name, { color: c.ink }]}>{companion.name}</Text>
      <View style={styles.feelingRow}>
        <View style={[styles.feelingDot, { backgroundColor: accent }]} />
        <Text style={[styles.feeling, { color: c.muted }]}>
          {selected ? `Feeling ${selected.label.toLowerCase()}` : "Waiting for your check-in"}
        </Text>
      </View>

      <View style={[styles.checkIn, { backgroundColor: c.surface2, borderColor: c.lineSoft }]}>
        <View style={styles.checkInHeader}>
          <View>
            <Text style={[styles.eyebrow, { color: c.moss }]}>QUICK CHECK-IN</Text>
            <Text style={[styles.question, { color: c.ink }]}>How are you feeling?</Text>
          </View>
          <Text style={[styles.checkInHint, { color: c.faint }]}>
            {checkInDue ? "Pick one" : "Change anytime"}
          </Text>
        </View>

        <View style={styles.moodRow} accessibilityRole="radiogroup">
          {CHECK_INS.map((item) => {
            const active = emotion === item.emotion;
            const optionAccent = emotionColor(item.emotion, c);
            return (
              <Pressable
                key={item.emotion}
                accessibilityRole="radio"
                accessibilityLabel={item.label}
                accessibilityState={{ checked: active }}
                onPress={() => onMoodChange(item.emotion)}
                style={({ pressed }) => [
                  styles.moodOption,
                  { backgroundColor: c.surface, borderColor: active ? optionAccent : c.line },
                  active && styles.moodOptionActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.moodIcon, { color: active ? optionAccent : c.muted }]}>
                  {item.icon}
                </Text>
                <Text style={[styles.moodLabel, { color: active ? c.ink : c.faint }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.checkInCopy, { color: c.muted }]}>
          {selected
            ? `${companion.name} is matching your ${selected.label.toLowerCase()} energy.`
            : "Your answer helps your companion respond during focus."}
        </Text>
      </View>

      <View style={styles.meters}>
        <Meter label="XP" value={`${companion.xp}/${companion.xp_needed}`} pct={xpPct} fill={c.moss} />
        <Meter
          label="HP"
          value={draining ? `${hp}  ↓` : String(hp)}
          pct={hp}
          fill={hp > 50 ? c.moss : hp > 25 ? c.citrus : c.clay}
        />
      </View>

      <Text style={[styles.focusedTogether, { color: c.faint }]}>
        {formatFocus(companion.total_focused_ms)}
      </Text>
    </View>
  );
}

function BreathingSprite({ draining, children }: { draining: boolean; children: React.ReactNode }) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: draining ? 380 : 1_900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: draining ? 380 : 1_900,
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
          {
            scale: breath.interpolate({
              inputRange: [0, 1],
              outputRange: [1, draining ? 1.03 : 1.018],
            }),
          },
          {
            translateX: breath.interpolate({
              inputRange: [0, 1],
              outputRange: [0, draining ? 2 : 0],
            }),
          },
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
              width: width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
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
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: "center",
    overflow: "hidden",
  },
  loadingCard: { minHeight: 340, justifyContent: "center", gap: 14 },
  loadingOrb: { width: 96, height: 96, borderRadius: 48 },
  loading: { fontFamily: roundedFont, fontSize: 15, fontWeight: "700" },
  topRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stagePill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  stage: { fontFamily: roundedFont, fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  healthPill: {
    minHeight: 29,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  healthDot: { width: 6, height: 6, borderRadius: 3 },
  healthText: { fontFamily: roundedFont, fontSize: 11, fontWeight: "900" },
  hero: { width: 216, height: 178, alignItems: "center", justifyContent: "center" },
  haloOuter: { position: "absolute", width: 176, height: 176, borderRadius: 88 },
  haloInner: { position: "absolute", width: 126, height: 126, borderRadius: 63 },
  name: { fontFamily: roundedFont, fontSize: 27, fontWeight: "900", letterSpacing: -0.5 },
  feelingRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  feelingDot: { width: 7, height: 7, borderRadius: 4 },
  feeling: { fontFamily: roundedFont, fontSize: 13, fontWeight: "700" },
  checkIn: {
    alignSelf: "stretch",
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    marginTop: 17,
  },
  checkInHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  eyebrow: { fontFamily: roundedFont, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  question: { fontFamily: roundedFont, fontSize: 15, fontWeight: "900", marginTop: 2 },
  checkInHint: { fontFamily: roundedFont, fontSize: 10, fontWeight: "700" },
  moodRow: { flexDirection: "row", gap: 6, marginTop: 11 },
  moodOption: {
    flex: 1,
    minHeight: 57,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  moodOptionActive: { borderWidth: 2, transform: [{ translateY: -2 }] },
  moodIcon: { fontFamily: roundedFont, fontSize: 21, fontWeight: "900", lineHeight: 24 },
  moodLabel: { fontFamily: roundedFont, fontSize: 8, fontWeight: "800" },
  checkInCopy: {
    fontFamily: roundedFont,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 9,
  },
  meters: { alignSelf: "stretch", gap: 8, marginTop: 17 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  meterLabel: { fontFamily: roundedFont, fontSize: 10, fontWeight: "900", width: 20 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  meterValue: {
    fontFamily: roundedFont,
    fontSize: 11,
    width: 56,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  focusedTogether: { fontFamily: roundedFont, fontSize: 10, fontWeight: "700", marginTop: 13 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
