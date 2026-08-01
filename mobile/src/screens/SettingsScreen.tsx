import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, roundedFont } from "../theme";

const APPS = [
  { name: "Instagram", color: "#f5d2bd" },
  { name: "TikTok", color: "#dcc9af" },
  { name: "YouTube", color: "#efc1ba" },
  { name: "X / Twitter", color: "#c7d4df" },
  { name: "Reddit", color: "#dfc1c1" },
  { name: "Snapchat", color: "#f1e3b9" },
  { name: "Netflix", color: "#cfbade" },
  { name: "Discord", color: "#bfcbe0" },
];

export function SettingsScreen({
  enabled,
  onToggle,
}: {
  enabled: Record<string, boolean>;
  onToggle: (appName: string, value: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => APPS.filter((app) => app.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Restricted apps</Text>
      <Text style={styles.subtitle}>Blocked apps show the check-in overlay if opened mid-session.</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search apps"
        placeholderTextColor={colors.nav}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.search}
      />

      <View style={styles.list}>
        {filtered.map((app, index) => (
          <View key={app.name} style={[styles.row, index < filtered.length - 1 && styles.divider]}>
            <View style={[styles.appIcon, { backgroundColor: app.color }]} />
            <Text style={styles.appName}>{app.name}</Text>
            <AppToggle
              value={Boolean(enabled[app.name])}
              onValueChange={(value) => onToggle(app.name, value)}
            />
          </View>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>No apps found.</Text>}
      </View>
    </ScrollView>
  );
}

function AppToggle({ value, onValueChange }: { value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleSlot}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={value ? "Restricted" : "Not restricted"}
        onPress={() => onValueChange(!value)}
        style={({ pressed }) => [
          styles.toggle,
          value && styles.toggleOn,
          pressed && styles.togglePressed,
        ]}
      >
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 34 },
  pageTitle: { color: colors.text, fontFamily: roundedFont, fontSize: 28, fontWeight: "900" },
  subtitle: {
    color: colors.muted,
    fontFamily: roundedFont,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginTop: 10,
  },
  search: {
    height: 52,
    marginTop: 20,
    marginBottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d9dcdc",
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.text,
    fontFamily: roundedFont,
    fontSize: 17,
    fontWeight: "600",
  },
  list: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: { minHeight: 73, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  appIcon: { width: 40, height: 40, borderRadius: 11 },
  appName: { flex: 1, color: colors.text, fontFamily: roundedFont, fontSize: 17, fontWeight: "800" },
  toggleSlot: { width: 58, height: 44, alignItems: "center", justifyContent: "center" },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: "center",
    backgroundColor: "#e7e0cf",
  },
  toggleOn: { backgroundColor: colors.accent },
  togglePressed: { opacity: 0.72 },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    shadowColor: "#5b5549",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: { alignSelf: "flex-end" },
  empty: { color: colors.muted, fontFamily: roundedFont, fontSize: 14, textAlign: "center", padding: 28 },
});
