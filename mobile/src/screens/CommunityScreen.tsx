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
import {
  type DirectoryUser,
  type Encouragement,
  type EncouragementBalance,
  type Friend,
  addFriend,
  fetchEncouragementBalance,
  fetchEncouragements,
  fetchFriends,
  searchUsers,
  sendEncouragement,
} from "../api";
import type { Leaderboard } from "../api";
import { radius, roundedFont, useTheme } from "../theme";

/**
 * Friends and encouragements, matching the web dashboard.
 *
 * The daily allowance is deliberately not recomputed here — the server owns
 * it, and a client that guessed would let someone send more than they have by
 * simply reopening the app.
 */
export function CommunityScreen({ leaderboard }: { leaderboard: Leaderboard | null }) {
  const { colors: c } = useTheme();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<Encouragement[]>([]);
  const [sent, setSent] = useState<Encouragement[]>([]);
  const [balance, setBalance] = useState<EncouragementBalance | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, e, s, b] = await Promise.all([
        fetchFriends(),
        fetchEncouragements("received"),
        fetchEncouragements("sent"),
        fetchEncouragementBalance(),
      ]);
      setFriends(f);
      setReceived(e);
      setSent(s);
      setBalance(b);
    } catch (e) {
      setNotice(
        e instanceof Error ? `Couldn't load your community — ${e.message}` : "Couldn't load your community.",
      );
    }
  }, []);

  useEffect(() => {
    // Initial hydration is intentionally owned by this mount effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const runSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      setResults(await searchUsers(text.trim()));
    } catch {
      setResults([]);
    }
  }, []);

  const onAdd = async (user: DirectoryUser) => {
    try {
      await addFriend(user.id);
      setNotice(`Added ${user.name}.`);
      setQuery("");
      setResults([]);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't add that person.");
    }
  };

  // Who has already been cheered today. Read from the server's own dayKey
  // rather than tracked locally, so it survives a reload and can't disagree
  // with the allowance the server is enforcing.
  const cheeredToday = new Set(
    sent.filter((e) => e.dayKey === balance?.date).map((e) => e.recipientId),
  );

  const onCheer = async (friend: Friend) => {
    try {
      await sendEncouragement(friend.id, friend.name);
      setNotice(`Sent ${friend.name} a cheer.`);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't send that.");
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
      <Text style={[styles.pageTitle, { color: c.ink }]}>Community</Text>
      {balance && (
        <Text style={[styles.subtitle, { color: c.muted }]}>
          {balance.available} cheer{balance.available === 1 ? "" : "s"} left today.
        </Text>
      )}

      <Card title="Find people">
        <TextInput
          value={query}
          onChangeText={runSearch}
          placeholder="Search by username"
          placeholderTextColor={c.faint}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
        />
        {results.map((user) => (
          <Pressable
            key={user.id}
            onPress={() => onAdd(user)}
            style={({ pressed }) => [styles.row, pressed && styles.dim]}
          >
            <Avatar initials={user.initials} />
            <Text style={[styles.name, { color: c.ink }]}>{user.name}</Text>
            <Text style={[styles.action, { color: c.moss }]}>Add</Text>
          </Pressable>
        ))}
        {query.trim().length >= 2 && results.length === 0 && (
          <Text style={[styles.body, { color: c.muted }]}>Nobody by that name.</Text>
        )}
      </Card>

      <Card title="Friends">
        {friends.length === 0 && (
          <Text style={[styles.body, { color: c.muted }]}>
            No friends yet. Search above — cheers are worth points on the leaderboard.
          </Text>
        )}
        {friends.map((friend) => (
          <View key={friend.id} style={styles.row}>
            <Avatar initials={friend.initials} />
            <Text style={[styles.name, { color: c.ink }]}>{friend.name}</Text>
            {cheeredToday.has(friend.id) ? (
              <View style={[styles.cheer, styles.cheered, { borderColor: c.line }]}>
                <Text style={[styles.cheerText, { color: c.muted }]}>Cheered ✓</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => onCheer(friend)}
                disabled={balance !== null && balance.available <= 0}
                style={({ pressed }) => [
                  styles.cheer,
                  { backgroundColor: c.moss },
                  (pressed || (balance !== null && balance.available <= 0)) && styles.dim,
                ]}
              >
                <Text style={[styles.cheerText, { color: c.surface }]}>Cheer</Text>
              </Pressable>
            )}
          </View>
        ))}
      </Card>

      <Card title="Leaderboard">
        {(leaderboard?.entries ?? []).length === 0 && (
          <Text style={[styles.body, { color: c.muted }]}>
            Nobody on the board yet. Points come from finished tasks and cheers received.
          </Text>
        )}
        {(leaderboard?.entries ?? []).slice(0, 10).map((entry) => (
          <View key={entry.userId} style={styles.row}>
            <Text style={[styles.rank, { color: entry.rank === 1 ? c.citrus : c.faint }]}>
              {entry.rank}
            </Text>
            <Text style={[styles.name, { color: c.ink }]}>{entry.displayName}</Text>
            <Text style={[styles.points, { color: c.muted }]}>{entry.points} pts</Text>
          </View>
        ))}
      </Card>

      <Card title="Cheers you've received">
        {received.length === 0 && (
          <Text style={[styles.body, { color: c.muted }]}>Nothing yet.</Text>
        )}
        {received.slice(0, 10).map((item) => (
          <Text key={item.id} style={[styles.body, { color: c.muted }]}>
            <Text style={{ color: c.ink, fontWeight: "800" }}>{item.senderName}</Text> cheered you
            on.
          </Text>
        ))}
      </Card>

      {notice && <Text style={[styles.notice, { color: c.muted }]}>{notice}</Text>}
    </ScrollView>
  );
}

function Avatar({ initials }: { initials: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: c.surface2 }]}>
      <Text style={[styles.avatarText, { color: c.muted }]}>{initials}</Text>
    </View>
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
  pageTitle: { fontFamily: roundedFont, fontSize: 28, fontWeight: "900" },
  subtitle: { fontFamily: roundedFont, fontSize: 15, marginBottom: 4 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: 18, gap: 10 },
  cardTitle: { fontFamily: roundedFont, fontSize: 16, fontWeight: "800" },
  body: { fontFamily: roundedFont, fontSize: 14, lineHeight: 21 },
  input: {
    height: 46,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: roundedFont,
    fontSize: 15,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: roundedFont, fontSize: 13, fontWeight: "800" },
  name: { flex: 1, fontFamily: roundedFont, fontSize: 15, fontWeight: "700" },
  rank: { width: 24, fontFamily: roundedFont, fontSize: 15, fontWeight: "800" },
  points: { fontFamily: roundedFont, fontSize: 13, fontVariant: ["tabular-nums"] },
  action: { fontFamily: roundedFont, fontSize: 14, fontWeight: "800" },
  cheer: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  cheered: { backgroundColor: "transparent", borderWidth: 1 },
  cheerText: { fontFamily: roundedFont, fontSize: 13, fontWeight: "800" },
  notice: { fontFamily: roundedFont, fontSize: 13, textAlign: "center" },
  dim: { opacity: 0.55 },
});
