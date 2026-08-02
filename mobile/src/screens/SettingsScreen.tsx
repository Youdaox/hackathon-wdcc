import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Companion } from "../api";
import { CHECKPOINT_MIN_MS, GRACE_MS } from "../config";
import { PIG_ACCESSORIES } from "../components/Pig";
import { AnimalSprite, SPECIES_COLORS, swatchFor } from "../components/AnimalSprite";
import { radius, roundedFont, useTheme } from "../theme";

/**
 * Settings: the things a user can actually change, plus a plain account of how
 * focus is measured.
 *
 * The honesty section isn't filler. The whole mechanic depends on trusting the
 * numbers, and someone who doesn't know what's being measured has no reason to
 * answer the check-in truthfully.
 */
export function SettingsScreen({
  companion,
  locationEnabled,
  onToggleLocation,
  onRename,
  onCustomise,
  account,
  onSignOut,
}: {
  companion: Companion | null;
  locationEnabled: boolean;
  onToggleLocation: (enabled: boolean) => void;
  onRename: (name: string) => void;
  onCustomise: (patch: {
    species?: Companion["species"];
    color?: Companion["color"];
    accessory?: Companion["accessory"];
  }) => void;
  account: { displayName: string } | null;
  onSignOut: () => void;
}) {
  const { colors: c } = useTheme();
  const [name, setName] = useState("");

  // Seed the field once the companion arrives, without clobbering whatever the
  // user is part-way through typing.
  useEffect(() => {
    // Sync once when the asynchronously loaded companion name arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (companion?.name && name === "") setName(companion.name);
  }, [companion?.name, name]);

  const renameDisabled = !name.trim() || name.trim() === companion?.name;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.pageTitle, { color: c.ink }]}>Settings</Text>

      <Card title="Your companion">
        <Text style={[styles.label, { color: c.faint }]}>NAME</Text>
        <View style={styles.nameRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => !renameDisabled && onRename(name.trim())}
            returnKeyType="done"
            maxLength={24}
            placeholder="Oinky"
            placeholderTextColor={c.faint}
            style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
          />
          <Pressable
            onPress={() => !renameDisabled && onRename(name.trim())}
            disabled={renameDisabled}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: c.moss },
              (pressed || renameDisabled) && styles.dim,
            ]}
          >
            <Text style={[styles.saveText, { color: c.surface }]}>Save</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: c.faint, marginTop: 16 }]}>ANIMAL</Text>
        <View style={styles.row}>
          {(["pig", "cow", "raccoon"] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityLabel={option}
              onPress={() => onCustomise({ species: option })}
              style={({ pressed }) => [
                styles.species,
                { borderColor: c.line, backgroundColor: c.surface2 },
                companion?.species === option && { borderColor: c.moss, borderWidth: 2 },
                pressed && styles.dim,
              ]}
            >
              <AnimalSprite
                species={option}
                mood="happy"
                level={9}
                color={SPECIES_COLORS[option][0]}
                size={46}
              />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: c.faint, marginTop: 16 }]}>COAT</Text>
        <View style={styles.row}>
          {(SPECIES_COLORS[companion?.species ?? "pig"] ?? []).map((option) => (
            <Pressable
              key={option}
              accessibilityLabel={`${option} coat`}
              onPress={() => onCustomise({ color: option })}
              style={({ pressed }) => [
                styles.swatch,
                {
                  backgroundColor: swatchFor(companion?.species ?? "pig", option),
                  borderColor: c.line,
                },
                companion?.color === option && { borderColor: c.ink, borderWidth: 3 },
                pressed && styles.dim,
              ]}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: c.faint, marginTop: 16 }]}>ACCESSORY</Text>
        <View style={styles.row}>
          {PIG_ACCESSORIES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => onCustomise({ accessory: option.value })}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: c.line, backgroundColor: c.surface2 },
                companion?.accessory === option.value && {
                  backgroundColor: c.moss,
                  borderColor: c.moss,
                },
                pressed && styles.dim,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: companion?.accessory === option.value ? c.surface : c.muted },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card title="Location bonus">
        <Text style={[styles.body, { color: c.muted }]}>
          Sessions finished at a verified study spot earn an XP multiplier. Incline takes one
          reading when a session starts — never background tracking.
        </Text>
        <Pressable
          onPress={() => onToggleLocation(!locationEnabled)}
          accessibilityRole="switch"
          accessibilityState={{ checked: locationEnabled }}
          style={({ pressed }) => [
            styles.toggleRow,
            { borderColor: c.line },
            pressed && styles.dim,
          ]}
        >
          <Text style={[styles.toggleLabel, { color: c.ink }]}>
            {locationEnabled ? "Location bonus on" : "Enable location bonus"}
          </Text>
          <View
            style={[
              styles.switch,
              { backgroundColor: locationEnabled ? c.moss : c.surface2 },
            ]}
          >
            <View style={[styles.knob, { backgroundColor: c.surface }, locationEnabled && styles.knobOn]} />
          </View>
        </Pressable>
        <Text style={[styles.body, { color: c.faint }]}>
          Nothing prompts for location until you turn this on, and declining costs you nothing but
          the bonus.
        </Text>
      </Card>

      <Card title="How focus is measured">
        <Text style={[styles.body, { color: c.muted }]}>
          Time counts only while Incline is the app on screen. Leave, and the clock keeps running
          but stops earning — the same rule the web version applies to a hidden tab.
        </Text>
        <Text style={[styles.body, { color: c.muted }]}>
          Away for more than {Math.round(CHECKPOINT_MIN_MS / 1000)}s and your companion asks about
          it when you return. Anything under {Math.round(GRACE_MS / 1000)}s is forgiven outright.
        </Text>
        <Text style={[styles.body, { color: c.muted }]}>
          Only &ldquo;I got distracted&rdquo; costs HP. Urgent things, task-switching and studying
          off-screen cost nothing — otherwise answering honestly would be pointless.
        </Text>
      </Card>

      <Card title="Pledges">
        <Text style={[styles.body, { color: c.muted }]}>
          Commit to a length before starting and the session carries stakes: stop before the time
          is up, or admit you were distracted, and it earns nothing.
        </Text>
        <Text style={[styles.body, { color: c.muted }]}>
          Pledges run on the clock, not your screen — putting the phone down and studying on paper
          still counts.
        </Text>
      </Card>

      {account && (
        <Card title="Account">
          <Text style={[styles.body, { color: c.muted }]}>
            Signed in as{" "}
            <Text style={{ color: c.ink, fontWeight: "800" }}>{account.displayName}</Text>. Your
            companion is shared with the desktop app.
          </Text>
          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [styles.signOut, { borderColor: c.line }, pressed && styles.dim]}
          >
            <Text style={[styles.signOutText, { color: c.clay }]}>Sign out</Text>
          </Pressable>
        </Card>
      )}
    </ScrollView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.cardTitle, { color: c.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 34, gap: 14 },
  pageTitle: { fontFamily: roundedFont, fontSize: 28, fontWeight: "900", marginBottom: 4 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 18, gap: 8 },
  cardTitle: { fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  label: { fontFamily: roundedFont, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  body: { fontFamily: roundedFont, fontSize: 14, lineHeight: 21 },
  nameRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    height: 46,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: roundedFont,
    fontSize: 16,
  },
  saveButton: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontFamily: roundedFont, fontSize: 15, fontWeight: "800" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  species: {
    width: 66,
    height: 66,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: roundedFont, fontSize: 13, fontWeight: "700" },
  signOut: {
    marginTop: 6,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { fontFamily: roundedFont, fontSize: 15, fontWeight: "800" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  toggleLabel: { fontFamily: roundedFont, fontSize: 15, fontWeight: "700" },
  switch: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
  knob: { width: 24, height: 24, borderRadius: 12 },
  knobOn: { alignSelf: "flex-end" },
  dim: { opacity: 0.55 },
});
