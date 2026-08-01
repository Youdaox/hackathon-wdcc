import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CHECKPOINT_MIN_MS, GRACE_MS } from "../config";
import { colors, roundedFont } from "../theme";

/** What the user types into their Shortcuts automation. */
const INTERCEPT_URL = "incline://intercept?app=Instagram";

/**
 * How focus is verified, plus the two opt-in restriction layers.
 *
 * There is no app picker here, because on iOS one couldn't work: the OS never
 * discloses which app is foregrounded, and shielding needs an entitlement Apple
 * grants only to paid accounts. What it does offer is a Shortcuts automation
 * the user builds themselves, so the setup steps live here rather than in a
 * control that would only pretend to block something.
 */
export function SettingsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>How it works</Text>
      <Text style={styles.subtitle}>
        Incline can&apos;t block apps on iOS. It measures honestly, asks about the gaps, and lets
        you put stakes and speed bumps in your own way.
      </Text>

      <Card title="Verified focus">
        <Text style={styles.body}>
          Time only counts while Incline is the app on screen. Leave, and the clock keeps running
          but stops earning — the same rule the web version applies to a hidden browser tab.
        </Text>
      </Card>

      <Card title="The check-in">
        <Text style={styles.body}>
          Away for more than {Math.round(CHECKPOINT_MIN_MS / 1000)} seconds and your companion asks
          about it when you return. You guess the length first, then see the real number.
        </Text>
        <Text style={styles.body}>
          Only &ldquo;I got distracted&rdquo; costs HP. Urgent things and genuine task-switching
          cost nothing — otherwise answering honestly would be pointless.
        </Text>
        <Text style={styles.body}>
          Anything under {Math.round(GRACE_MS / 1000)} seconds is forgiven outright.
        </Text>
      </Card>

      <Card title="Location">
        <Text style={styles.body}>
          One reading, taken when a session starts — never background tracking. If you&apos;re at a
          verified study spot the session earns a multiplier. Declining costs you nothing but the
          bonus.
        </Text>
      </Card>

      <Card title="Intercepts (optional setup)">
        <Text style={styles.body}>
          iOS won&apos;t let an app detect or block another app. It will, however, run an
          automation you build yourself — so you can point one back at Incline.
        </Text>
        <Text style={styles.body}>In the Shortcuts app:</Text>
        <Step n={1} text="Automation tab → + → App" />
        <Step n={2} text="Choose the app that distracts you → Is Opened → Next" />
        <Step n={3} text="New Blank Automation → Add Action → search “Open URL”" />
        <Step n={4} text={`Set the URL to  ${INTERCEPT_URL}`} />
        <Step n={5} text="Turn OFF “Ask Before Running”, then Done" />
        <Text style={styles.body}>
          Now opening that app during a session throws you straight back here. Change the{" "}
          <Text style={styles.mono}>?app=</Text> part to whatever you want the screen to say.
        </Text>
        <Text style={styles.caveat}>
          Honest caveat: this is your automation, not a lock. You can delete it, and Incline never
          learns which app you opened unless the URL tells it. It&apos;s a speed bump you chose to
          put there — which is the strongest thing iOS allows without Apple&apos;s approval.
        </Text>
      </Card>

      <Card title="Pledges">
        <Text style={styles.body}>
          Pick a length before you start and the session carries stakes: stop early, or push past
          an intercept, and it earns nothing at all. HP still moves — the session happened.
        </Text>
        <Text style={styles.body}>
          Choose &ldquo;Open&rdquo; instead and there&apos;s no forfeit, just the usual tracking.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 34, gap: 14 },
  pageTitle: { color: colors.text, fontFamily: roundedFont, fontSize: 28, fontWeight: "900" },
  subtitle: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: 6,
  },
  card: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  body: { color: colors.muted, fontFamily: roundedFont, fontSize: 14, lineHeight: 21 },
  mono: { color: colors.text, fontWeight: "800" },
  caveat: {
    color: colors.nav,
    fontFamily: roundedFont,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accentPale,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNum: { color: colors.text, fontFamily: roundedFont, fontSize: 12, fontWeight: "800" },
  stepText: {
    flex: 1,
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 14,
    lineHeight: 21,
  },
});
