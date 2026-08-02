import { Pressable, StyleSheet, Text, View } from "react-native";
import { roundedFont, useTheme } from "../theme";

export type TabName = "home" | "schedule" | "recap" | "community" | "settings";

const TABS: { key: TabName; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "schedule", label: "Plan" },
  { key: "recap", label: "Recap" },
  { key: "community", label: "Friends" },
  { key: "settings", label: "Settings" },
];

export function BottomNav({ active, onChange }: { active: TabName; onChange: (tab: TabName) => void }) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.nav, { backgroundColor: c.surface, borderTopColor: c.line }]}>
      {TABS.map((tab) => {
        const selected = active === tab.key;
        const tint = selected ? c.moss : c.faint;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={[styles.iconShell, selected && { backgroundColor: c.accentPale }]}>
              <NavIcon name={tab.key} color={tint} />
            </View>
            <Text style={[styles.label, { color: tint }, selected && styles.labelSelected]}>
              {tab.label}
            </Text>
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
        <View style={[styles.houseRoof, { borderBottomColor: color }]} />
        <View style={[styles.houseBody, { borderColor: color }]}>
          <View style={[styles.door, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }

  if (name === "schedule") {
    return (
      <View style={[styles.calendar, { borderColor: color }]}>
        <View style={[styles.calendarTop, { backgroundColor: color }]} />
        <View style={styles.calendarGrid}>
          {[0, 1, 2, 3].map((dot) => (
            <View key={dot} style={[styles.calendarDot, { backgroundColor: color }]} />
          ))}
        </View>
      </View>
    );
  }

  if (name === "recap") {
    return (
      <View style={[styles.iconBox, styles.bars]}>
        <View style={[styles.bar, { height: 10, backgroundColor: color }]} />
        <View style={[styles.bar, { height: 19, backgroundColor: color }]} />
        <View style={[styles.bar, { height: 14, backgroundColor: color }]} />
      </View>
    );
  }

  if (name === "community") {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.personHead, styles.personLeft, { backgroundColor: color }]} />
        <View style={[styles.personHead, styles.personRight, { backgroundColor: color }]} />
        <View style={[styles.peopleBody, { borderColor: color }]} />
      </View>
    );
  }

  return (
    <View style={[styles.gear, { borderColor: color }]}>
      <View style={[styles.gearCenter, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    minHeight: 74,
    paddingTop: 7,
    paddingBottom: 6,
    paddingHorizontal: 5,
    flexDirection: "row",
    borderTopWidth: 1,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  pressed: { opacity: 0.58 },
  iconShell: {
    width: 42,
    height: 31,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: roundedFont, fontSize: 9, fontWeight: "700" },
  labelSelected: { fontWeight: "900" },
  iconBox: { width: 24, height: 22, alignItems: "center", justifyContent: "flex-end" },
  houseRoof: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  houseBody: {
    width: 18,
    height: 13,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  door: { width: 4, height: 7, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  calendar: { width: 20, height: 19, borderRadius: 4, borderWidth: 2, overflow: "hidden" },
  calendarTop: { height: 4 },
  calendarGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 3,
  },
  calendarDot: { width: 3, height: 3, borderRadius: 1 },
  bars: { flexDirection: "row", gap: 3, alignItems: "flex-end" },
  bar: { width: 5, borderRadius: 2 },
  personHead: { position: "absolute", top: 1, width: 8, height: 8, borderRadius: 4 },
  personLeft: { left: 3 },
  personRight: { right: 3 },
  peopleBody: { width: 22, height: 10, borderWidth: 2, borderRadius: 8, borderBottomWidth: 0 },
  gear: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },
  gearCenter: { width: 7, height: 7, borderRadius: 4, borderWidth: 2 },
});
