import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { FocusState } from "../useFocusSession";
import { HP_ESCALATE_AFTER_MS, HP_GRACE_MS, hpCostForAway } from "../config";
import { colors, formatDuration, roundedFont } from "../theme";
import { nzClock } from "../timezone";

const PLEDGES = [0, 15, 25, 50];

function clockOf(ts: number): string {
  return nzClock(ts);
}

export function FocusPanel({
  state,
  multiplier,
  busy,
  pledge,
  onPledgeChange,
  onStart,
  onStop,
}: {
  state: FocusState;
  multiplier: number;
  busy: boolean;
  pledge: number;
  onPledgeChange: (minutes: number) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const penalised = state.distractions.filter((d) => d.durationMs >= 5_000).length;

  // A slow pulse on the live card while away, so the cost registers
  // peripherally rather than having to be read.
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!state.away) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state.away, pulse]);

  return (
    <View style={styles.wrap}>
      {state.running && state.plantMode && (
        <PlantStatus paused={state.plantPaused || state.away} pickups={state.phonePickups} />
      )}

      {state.running && (
        <Animated.View
          style={[
            styles.liveCard,
            state.away && {
              borderColor: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.border, colors.clay],
              }),
            },
          ]}
        >
          <View>
            <Text style={styles.liveLabel}>
              {state.away || state.plantPaused ? "FOCUS PAUSED" : "VERIFIED FOCUS"}
            </Text>
            <Text style={styles.clock}>{formatDuration(state.focusedMs)}</Text>
          </View>
          <View style={styles.liveStats}>
            <Text style={[styles.stat, state.away && styles.statAway]}>
              {formatDuration(state.distractedMs)} away
              {state.away && state.distractedMs <= HP_GRACE_MS
                ? " · paused"
                : hpCostForAway(state.distractedMs) > 0
                  ? ` · −${Math.round(hpCostForAway(state.distractedMs))} HP`
                  : ""}
              {state.away && state.distractedMs > HP_ESCALATE_AFTER_MS ? " ⚠︎" : ""}
            </Text>
            <Text style={styles.stat}>
              {state.plantMode ? `${state.phonePickups} pickups` : `${penalised} breaks`} · {multiplier}x
            </Text>
          </View>
        </Animated.View>
      )}

      {!state.running && (
        <View style={styles.pledgeRow}>
          {PLEDGES.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => onPledgeChange(minutes)}
              style={({ pressed }) => [
                styles.pledgeChip,
                pledge === minutes && styles.pledgeChipOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.pledgeText, pledge === minutes && styles.pledgeTextOn]}>
                {minutes === 0 ? "Open" : `${minutes}m`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!state.running && pledge > 0 && (
        <Text style={styles.pledgeNote}>
          Stop before the time is up, or admit you were distracted, and this session earns
          nothing. Stepping away for something real doesn&apos;t count against you.
        </Text>
      )}

      {state.running && state.pledgeMinutes > 0 && (
        <Text style={styles.pledgeNote}>
          {state.away
            ? "Away — your pledge runs on the clock, not your screen."
            : `Pledged ${state.pledgeMinutes} minutes${
                state.endsAt ? ` — done at ${clockOf(state.endsAt)}` : ""
              }.`}
        </Text>
      )}

      <Pressable
        onPress={state.running ? onStop : onStart}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          state.running && styles.stopButton,
          (pressed || busy) && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {busy ? "Syncing…" : state.running ? "End Focus Session" : "Start Focus Session"}
        </Text>
      </Pressable>
    </View>
  );
}

function PlantStatus({ paused, pickups }: { paused: boolean; pickups: number }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (paused) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1_200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1_200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [paused, pulse]);

  return (
    <View
      style={[styles.plantStatus, paused && styles.plantStatusPaused]}
      accessible
      accessibilityLabel={paused ? "Focus paused. Put your phone face-down." : "Phone planted. Verified focus is active."}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.pulseFrame}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.35] }) },
              ],
            },
          ]}
        />
        <View style={[styles.plantDot, paused && styles.plantDotPaused]} />
      </View>
      <View style={styles.plantCopy}>
        <Text style={styles.plantTitle}>{paused ? "Put your phone face-down" : "Phone planted"}</Text>
        <Text style={styles.plantSubtitle}>
          {paused
            ? `Verified focus is paused · ${pickups} ${pickups === 1 ? "pickup" : "pickups"}`
            : "Keep it still and let your focus grow"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  plantStatus: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accentPale,
    backgroundColor: "#eff8f1",
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  plantStatusPaused: { borderColor: "#f0cab7", backgroundColor: "#fff5ee" },
  pulseFrame: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  pulseRing: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
  },
  plantDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent },
  plantDotPaused: { backgroundColor: colors.peach },
  plantCopy: { flex: 1, gap: 3 },
  plantTitle: { color: colors.text, fontFamily: roundedFont, fontSize: 16, fontWeight: "900" },
  plantSubtitle: { color: colors.muted, fontFamily: roundedFont, fontSize: 12, fontWeight: "600" },
  liveCard: {
    minHeight: 82,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveLabel: { color: colors.muted, fontFamily: roundedFont, fontSize: 11, letterSpacing: 0.9 },
  clock: { color: colors.text, fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  liveStats: { alignItems: "flex-end", gap: 4 },
  pledgeRow: { flexDirection: "row", gap: 8 },
  pledgeChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  pledgeChipOn: { backgroundColor: colors.accentPale, borderColor: colors.accent },
  pledgeText: { color: colors.muted, fontFamily: roundedFont, fontSize: 15, fontWeight: "700" },
  pledgeTextOn: { color: colors.text },
  pledgeNote: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  stat: { color: colors.muted, fontFamily: roundedFont, fontSize: 12 },
  statAway: { color: colors.clay, fontWeight: "800" },
  button: {
    minHeight: 66,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  stopButton: { backgroundColor: colors.bad },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  buttonText: {
    color: colors.surface,
    fontFamily: roundedFont,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
