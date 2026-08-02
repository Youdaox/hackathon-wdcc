import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PlantModeState } from "../usePlantMode";
import { Pig } from "../components/Pig";
import { colors, roundedFont } from "../theme";

export function PlantSetupScreen({
  state,
  onCancel,
  onContinueWithoutSensor,
}: {
  state: PlantModeState;
  onCancel: () => void;
  onContinueWithoutSensor: () => void;
}) {
  const unavailable = state.phase === "unavailable";
  const calibrating = state.phase === "calibrating";

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.topBar}>
        <Text style={styles.eyebrow}>PLANT-TO-FOCUS</Text>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={[styles.plantHalo, calibrating && styles.plantHaloActive]}>
          <Pig mood="happy" level={3} size={112} />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {unavailable
            ? "Motion sensing unavailable"
            : calibrating
              ? "Fern is taking root…"
              : "Plant your phone"}
        </Text>
        <Text style={styles.instructions} accessibilityLiveRegion="polite">
          {unavailable
            ? state.error
            : calibrating
              ? "Keep your phone face-down and completely still."
              : "Place your phone face-down on a flat surface to begin verified focus."}
        </Text>

        {!unavailable && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(4, Math.round(state.calibrationProgress * 100))}%` },
              ]}
            />
          </View>
        )}

        <View style={styles.tipCard}>
          <View style={styles.tipDot} />
          <Text style={styles.tipText}>
            Incline stays open and keeps the screen awake. Expo Go can’t verify focus after the app
            is backgrounded or closed.
          </Text>
        </View>

        {unavailable && (
          <Pressable
            accessibilityRole="button"
            onPress={onContinueWithoutSensor}
            style={({ pressed }) => [styles.fallbackButton, pressed && styles.pressed]}
          >
            <Text style={styles.fallbackButtonText}>Start regular session</Text>
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
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 28,
  },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: {
    color: colors.accent,
    fontFamily: roundedFont,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  cancelText: { color: colors.muted, fontFamily: roundedFont, fontSize: 15, fontWeight: "700" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  plantHalo: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.surface,
    borderWidth: 12,
    borderColor: colors.accentPale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  plantHaloActive: { borderColor: colors.accentSoft },
  title: {
    color: colors.text,
    fontFamily: roundedFont,
    fontSize: 29,
    fontWeight: "900",
    textAlign: "center",
  },
  instructions: {
    maxWidth: 340,
    color: colors.muted,
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
    backgroundColor: "#e8e2d5",
    overflow: "hidden",
    marginTop: 24,
  },
  progressFill: { height: "100%", borderRadius: 5, backgroundColor: colors.accent },
  tipCard: {
    width: "100%",
    maxWidth: 380,
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    marginTop: 32,
  },
  tipDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.peach, marginTop: 5 },
  tipText: {
    flex: 1,
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  fallbackButton: {
    width: "100%",
    maxWidth: 380,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  fallbackButtonText: {
    color: colors.surface,
    fontFamily: roundedFont,
    fontSize: 17,
    fontWeight: "900",
  },
  pressed: { opacity: 0.72 },
});
