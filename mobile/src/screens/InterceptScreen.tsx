import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Sprout } from "../components/Sprout";
import { colors, formatDuration, roundedFont } from "../theme";

/**
 * The intercept — shown when a Shortcuts automation caught the user opening a
 * distracting app during a session.
 *
 * iOS gives no way to prevent an app from opening, so this is not a block: the
 * user has already switched, and a Personal Automation they set up themselves
 * has thrown them back here. That distinction is deliberate in the copy — the
 * app doesn't claim to have stopped anything, it claims to have noticed.
 *
 * "Let me through" is a real escape hatch on purpose. An intercept you cannot
 * dismiss gets the automation deleted within a day. The cost is that it breaks
 * a pledge, which the server enforces.
 */
export function InterceptScreen({
  appLabel,
  focusedMs,
  pledgeMinutes,
  onReturn,
  onBypass,
}: {
  appLabel: string | null;
  focusedMs: number;
  pledgeMinutes: number;
  onReturn: () => void;
  onBypass: () => void;
}) {
  const app = appLabel ?? "That app";

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen">
      <View style={styles.root}>
        <Sprout size={120} stage={2} happy={false} />

        <Text style={styles.title}>{app} can wait</Text>
        <Text style={styles.body}>
          You&apos;re {formatDuration(focusedMs)} into this session.
          {pledgeMinutes > 0
            ? ` You promised ${pledgeMinutes} minutes — pushing through now forfeits it.`
            : " Coming straight back costs you nothing."}
        </Text>

        <Pressable
          onPress={onReturn}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Back to focusing</Text>
        </Pressable>

        <Pressable
          onPress={onBypass}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>
            {pledgeMinutes > 0 ? "Let me through (forfeits the session)" : "Let me through"}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: {
    color: colors.text,
    fontFamily: roundedFont,
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 22,
  },
  body: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 320,
  },
  primary: {
    alignSelf: "stretch",
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 38,
  },
  primaryText: {
    color: colors.surface,
    fontFamily: roundedFont,
    fontSize: 19,
    fontWeight: "800",
  },
  secondary: { paddingVertical: 18, paddingHorizontal: 12, marginTop: 6 },
  secondaryText: {
    color: colors.nav,
    fontFamily: roundedFont,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  pressed: { opacity: 0.7 },
});
