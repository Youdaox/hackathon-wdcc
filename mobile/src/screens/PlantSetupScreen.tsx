import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Companion } from "../api";
import type { PlantModeState } from "../usePlantMode";
import { AnimalSprite } from "../components/AnimalSprite";
import { radius, roundedFont, useTheme } from "../theme";

export function PlantSetupScreen({
  state,
  companion,
  onCancel,
  onContinueWithoutSensor,
}: {
  state: PlantModeState;
  companion: Companion | null;
  onCancel: () => void;
  onContinueWithoutSensor: () => void;
}) {
  const { colors: c } = useTheme();
  const unavailable = state.phase === "unavailable";
  const calibrating = state.phase === "calibrating";

  return (
    <View style={[styles.overlay, { backgroundColor: c.canvas }]} accessibilityViewIsModal>
      <View style={styles.topBar}>
        <Text style={[styles.eyebrow, { color: c.moss }]}>PLANT-TO-FOCUS</Text>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}>
          <Text style={[styles.cancelText, { color: c.muted }]}>Cancel</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.plantHalo,
            { backgroundColor: c.surface, borderColor: calibrating ? c.moss : c.accentPale },
          ]}
        >
          <View style={[styles.innerHalo, { backgroundColor: c.accentPale }]} />
          <AnimalSprite
            species={companion?.species ?? "pig"}
            mood={companion?.mood ?? "happy"}
            level={companion?.level ?? 3}
            color={companion?.color ?? "pink"}
            accessory={companion?.accessory ?? "none"}
            hp={companion?.hp ?? 100}
            size={126}
          />
        </View>

        <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header">
          {unavailable
            ? "Motion sensing unavailable"
            : calibrating
              ? "Almost planted…"
              : "Plant your phone"}
        </Text>
        <Text style={[styles.instructions, { color: c.muted }]} accessibilityLiveRegion="polite">
          {unavailable
            ? state.error
            : calibrating
              ? "Keep your phone face-down and completely still."
              : "Place your phone face-down on a flat surface to begin verified focus."}
        </Text>

        {!unavailable && (
          <View style={[styles.progressTrack, { backgroundColor: c.surface2 }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: c.moss },
                { width: `${Math.max(4, Math.round(state.calibrationProgress * 100))}%` },
              ]}
            />
          </View>
        )}

        <View style={[styles.tipCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.tipDot, { backgroundColor: c.amber }]} />
          <Text style={[styles.tipText, { color: c.muted }]}>
            Incline stays open and keeps the screen awake. Expo Go can’t verify focus after the app
            is backgrounded or closed.
          </Text>
        </View>

        {unavailable && (
          <Pressable
            accessibilityRole="button"
            onPress={onContinueWithoutSensor}
            style={({ pressed }) => [
              styles.fallbackButton,
              { backgroundColor: c.moss },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.fallbackButtonText, { color: c.surface }]}>Start regular session</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 28,
  },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: {
    fontFamily: roundedFont,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  cancelText: { fontFamily: roundedFont, fontSize: 15, fontWeight: "700" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  plantHalo: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  innerHalo: { position: "absolute", width: 144, height: 144, borderRadius: 72 },
  title: {
    fontFamily: roundedFont,
    fontSize: 29,
    fontWeight: "900",
    textAlign: "center",
  },
  instructions: {
    maxWidth: 340,
    fontFamily: roundedFont,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
    textAlign: "center",
    marginTop: 12,
  },
  progressTrack: {
    width: "78%",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 24,
  },
  progressFill: { height: "100%", borderRadius: 5 },
  tipCard: {
    width: "100%",
    maxWidth: 380,
    flexDirection: "row",
    gap: 12,
    borderRadius: radius.control,
    borderWidth: 1,
    padding: 16,
    marginTop: 32,
  },
  tipDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  tipText: {
    flex: 1,
    fontFamily: roundedFont,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  fallbackButton: {
    width: "100%",
    maxWidth: 380,
    minHeight: 58,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  fallbackButtonText: {
    fontFamily: roundedFont,
    fontSize: 17,
    fontWeight: "900",
  },
  pressed: { opacity: 0.72 },
});
