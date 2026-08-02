import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { type StudyBlock, createBlock, deleteBlock, fetchSchedule } from "../api";
import { radius, roundedFont, useTheme } from "../theme";

/**
 * Weekly study blocks.
 *
 * Times are minutes-from-midnight throughout, matching the web model, so the
 * only conversion is at the edges where a human reads them.
 */

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Accepts "9", "9:30", "0930" — anything a person types in a hurry. */
function parseTime(input: string): number | null {
  const clean = input.trim().replace(/[^\d:]/g, "");
  if (!clean) return null;
  if (clean.includes(":")) {
    const [h, m] = clean.split(":").map(Number);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
    return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
  }
  if (clean.length <= 2) {
    const h = Number(clean);
    return h >= 0 && h < 24 ? h * 60 : null;
  }
  const h = Number(clean.slice(0, clean.length - 2));
  const m = Number(clean.slice(-2));
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
}

export function ScheduleScreen() {
  const { colors: c } = useTheme();
  const [blocks, setBlocks] = useState<StudyBlock[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [days, setDays] = useState<number[]>([]);

  const load = useCallback(async () => {
    try {
      setBlocks(await fetchSchedule());
      setNotice(null);
    } catch {
      setNotice("Couldn't load your schedule.");
    }
  }, []);

  useEffect(() => {
    // Initial hydration is intentionally owned by this mount effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const add = async () => {
    const startMin = parseTime(start);
    const endMin = parseTime(end);
    if (!title.trim()) return setNotice("Give the block a name.");
    if (startMin === null || endMin === null) return setNotice("Times look like 9:30 or 0930.");
    if (endMin <= startMin) return setNotice("The end time has to be after the start.");
    if (days.length === 0) return setNotice("Pick at least one day.");

    try {
      await createBlock({
        title: title.trim(),
        course: course.trim(),
        start_min: startMin,
        end_min: endMin,
        days,
      });
      setTitle("");
      setCourse("");
      setStart("");
      setEnd("");
      setDays([]);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't save that block.");
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={c.muted}
        />
      }
    >
      <Text style={[styles.pageTitle, { color: c.ink }]}>Schedule</Text>
      <Text style={[styles.subtitle, { color: c.muted }]}>
        Blocks are shared with the desktop app.
      </Text>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.cardTitle, { color: c.ink }]}>Add a block</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What are you studying?"
          placeholderTextColor={c.faint}
          style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
        />
        <TextInput
          value={course}
          onChangeText={setCourse}
          placeholder="Course, e.g. COMPSCI 235"
          placeholderTextColor={c.faint}
          autoCapitalize="characters"
          style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
        />
        <View style={styles.timeRow}>
          <TextInput
            value={start}
            onChangeText={setStart}
            placeholder="09:00"
            placeholderTextColor={c.faint}
            keyboardType="numbers-and-punctuation"
            style={[
              styles.input,
              styles.timeInput,
              { borderColor: c.line, backgroundColor: c.surface, color: c.ink },
            ]}
          />
          <TextInput
            value={end}
            onChangeText={setEnd}
            placeholder="10:30"
            placeholderTextColor={c.faint}
            keyboardType="numbers-and-punctuation"
            style={[
              styles.input,
              styles.timeInput,
              { borderColor: c.line, backgroundColor: c.surface, color: c.ink },
            ]}
          />
        </View>

        <View style={styles.dayRow}>
          {DAYS.map((label, index) => {
            const on = days.includes(index);
            return (
              <Pressable
                key={index}
                accessibilityLabel={DAY_FULL[index]}
                onPress={() =>
                  setDays((current) =>
                    current.includes(index)
                      ? current.filter((d) => d !== index)
                      : [...current, index],
                  )
                }
                style={({ pressed }) => [
                  styles.day,
                  { borderColor: c.line, backgroundColor: on ? c.moss : c.surface2 },
                  pressed && styles.dim,
                ]}
              >
                <Text style={[styles.dayText, { color: on ? c.surface : c.muted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={add}
          style={({ pressed }) => [styles.add, { backgroundColor: c.moss }, pressed && styles.dim]}
        >
          <Text style={[styles.addText, { color: c.surface }]}>Add block</Text>
        </Pressable>
      </View>

      {blocks.map((block) => (
        <View
          key={block.id}
          style={[styles.block, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <View style={styles.blockCopy}>
            <Text style={[styles.blockTitle, { color: c.ink }]}>{block.title}</Text>
            <Text style={[styles.blockMeta, { color: c.muted }]}>
              {block.days.map((d) => DAY_FULL[d]).join(", ")} · {hhmm(block.start_min)}–
              {hhmm(block.end_min)}
              {block.course ? ` · ${block.course}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => void deleteBlock(block.id).then(load)}
            hitSlop={10}
            style={({ pressed }) => [pressed && styles.dim]}
          >
            <Text style={[styles.remove, { color: c.clay }]}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {blocks.length === 0 && (
        <Text style={[styles.empty, { color: c.muted }]}>
          No blocks yet. Add one and your companion will know when you meant to study.
        </Text>
      )}

      {notice && <Text style={[styles.notice, { color: c.clay }]}>{notice}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 34, gap: 12 },
  pageTitle: { fontFamily: roundedFont, fontSize: 28, fontWeight: "900" },
  subtitle: { fontFamily: roundedFont, fontSize: 14, marginBottom: 4 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 18, gap: 10 },
  cardTitle: { fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  input: {
    height: 46,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: roundedFont,
    fontSize: 15,
  },
  timeRow: { flexDirection: "row", gap: 10 },
  timeInput: { flex: 1 },
  dayRow: { flexDirection: "row", gap: 6, justifyContent: "space-between" },
  day: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontFamily: roundedFont, fontSize: 14, fontWeight: "800" },
  add: {
    minHeight: 48,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  addText: { fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  block: {
    borderRadius: radius.control,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  blockCopy: { flex: 1, gap: 3 },
  blockTitle: { fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  blockMeta: { fontFamily: roundedFont, fontSize: 13 },
  remove: { fontFamily: roundedFont, fontSize: 13, fontWeight: "700" },
  empty: { fontFamily: roundedFont, fontSize: 14, lineHeight: 21, textAlign: "center" },
  notice: { fontFamily: roundedFont, fontSize: 13, textAlign: "center" },
  dim: { opacity: 0.6 },
});
