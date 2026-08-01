import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, roundedFont } from "../theme";

export type TabName = "home" | "recap" | "ranks" | "settings";

const TABS: { key: TabName; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "recap", label: "Recap" },
  { key: "ranks", label: "Ranks" },
  { key: "settings", label: "Settings" },
];

export function BottomNav({ active, onChange }: { active: TabName; onChange: (tab: TabName) => void }) {
  return (
    <View style={styles.nav}>
      {TABS.map((tab) => {
        const selected = active === tab.key;
        const tint = selected ? colors.accent : colors.nav;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <NavIcon name={tab.key} color={tint} />
            <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NavIcon({ name, color }: { name: TabName; color: string }) {
  if (name === "home") {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.houseRoof, { backgroundColor: color }]} />
        <View style={[styles.houseBody, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === "recap") {
    return (
      <View style={[styles.iconBox, styles.bars]}>
        <View style={[styles.bar, { height: 16, backgroundColor: color }]} />
        <View style={[styles.bar, { height: 28, backgroundColor: color }]} />
        <View style={[styles.bar, { height: 21, backgroundColor: color }]} />
      </View>
    );
  }

  if (name === "ranks") {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.medal, { backgroundColor: color }]} />
        <View style={[styles.ribbonLeft, { borderTopColor: color }]} />
        <View style={[styles.ribbonRight, { borderTopColor: color }]} />
      </View>
    );
  }

  return <View style={[styles.ring, { borderColor: color }]} />;
}

const styles = StyleSheet.create({
  nav: {
    minHeight: 78,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  pressed: { opacity: 0.62 },
  label: { fontFamily: roundedFont, fontSize: 14, fontWeight: "700" },
  iconBox: { width: 34, height: 30, alignItems: "center", justifyContent: "flex-end" },
  houseRoof: {
    position: "absolute",
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 3,
    transform: [{ rotate: "45deg" }],
  },
  houseBody: { width: 30, height: 20, borderRadius: 3 },
  bars: { flexDirection: "row", gap: 3, alignItems: "flex-end" },
  bar: { width: 6, borderRadius: 2 },
  medal: { position: "absolute", top: 0, width: 14, height: 14, borderRadius: 7 },
  ribbonLeft: {
    position: "absolute",
    left: 5,
    top: 12,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    transform: [{ rotate: "12deg" }],
  },
  ribbonRight: {
    position: "absolute",
    right: 4,
    top: 12,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    transform: [{ rotate: "-12deg" }],
  },
  ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 7 },
});
