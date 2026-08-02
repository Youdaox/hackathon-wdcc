import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Pig } from "../components/Pig";
import { type Account, login, register } from "../auth";
import { radius, roundedFont, useTheme } from "../theme";

/**
 * Sign in with the same account the web and desktop apps use.
 *
 * This is what connects the two: without a shared identity the phone grows its
 * own pig, and the friends, encouragements and Canvas endpoints — all
 * cookie-authenticated — stay unreachable.
 */
export function LoginScreen({ onSignedIn }: { onSignedIn: (account: Account) => void }) {
  const { colors: c } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const account = await (mode === "login" ? login : register)(username.trim(), password);
      onSignedIn(account);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: c.canvas }]}
    >
      <View style={styles.inner}>
        <Pig mood="happy" level={5} size={128} />
        <Text style={[styles.title, { color: c.ink }]}>Incline</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          {mode === "login"
            ? "Sign in and your companion follows you from the desktop app."
            : "Create an account — your companion is shared everywhere you sign in."}
        </Text>

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={c.faint}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={c.faint}
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={submit}
          returnKeyType="go"
          style={[styles.input, { borderColor: c.line, backgroundColor: c.surface, color: c.ink }]}
        />

        {error && <Text style={[styles.error, { color: c.clay }]}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy || !username.trim() || !password}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: c.moss },
            (pressed || busy || !username.trim() || !password) && styles.dim,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={c.surface} />
          ) : (
            <Text style={[styles.buttonText, { color: c.surface }]}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          hitSlop={10}
        >
          <Text style={[styles.switch, { color: c.muted }]}>
            {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 32, alignItems: "center", gap: 10 },
  title: { fontFamily: roundedFont, fontSize: 34, fontWeight: "900", marginTop: 12 },
  subtitle: {
    fontFamily: roundedFont,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 18,
    maxWidth: 300,
  },
  input: {
    alignSelf: "stretch",
    height: 52,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: roundedFont,
    fontSize: 16,
  },
  error: { fontFamily: roundedFont, fontSize: 14, textAlign: "center" },
  button: {
    alignSelf: "stretch",
    minHeight: 54,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: { fontFamily: roundedFont, fontSize: 17, fontWeight: "800" },
  switch: { fontFamily: roundedFont, fontSize: 14, marginTop: 16 },
  dim: { opacity: 0.55 },
});
