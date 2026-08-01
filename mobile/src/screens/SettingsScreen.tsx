import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { colors, roundedFont } from "../theme";

const APPS = [
  { name: "Instagram", color: "#f5d2bd", enabled: true },
  { name: "TikTok", color: "#dcc9af", enabled: true },
  { name: "YouTube", color: "#efc1ba", enabled: true },
  { name: "X / Twitter", color: "#c7d4df", enabled: false },
  { name: "Reddit", color: "#dfc1c1", enabled: false },
  { name: "Snapchat", color: "#f1e3b9", enabled: false },
  { name: "Netflix", color: "#cfbade", enabled: false },
  { name: "Discord", color: "#bfcbe0", enabled: false },
];

export function SettingsScreen() {
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(APPS.map((app) => [app.name, app.enabled])),
  );
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
            <Switch
              value={enabled[app.name]}
              onValueChange={(value) => setEnabled((current) => ({ ...current, [app.name]: value }))}
              trackColor={{ false: "#e7e0cf", true: colors.accent }}
              thumbColor={colors.surface}
              ios_backgroundColor="#e7e0cf"
            />
          </View>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>No apps found.</Text>}
      </View>
    </ScrollView>
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
  empty: { color: colors.muted, fontFamily: roundedFont, fontSize: 14, textAlign: "center", padding: 28 },
});
