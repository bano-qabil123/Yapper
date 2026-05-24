import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert("Missing fields", "Fill in all fields.");
      return;
    }
    if (username.includes(" ")) {
      Alert.alert("Invalid username", "No spaces allowed.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "At least 6 characters.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert("Sign up failed", error.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username: username.toLowerCase(),
        bio: null,
        avatar_url: null,
        verified: false,
      });
      if (profileError) {
        setLoading(false);
        Alert.alert("Profile error", profileError.message);
        return;
      }
    }
    setLoading(false);
  };

  const inputStyle = (field: string) => ({
    backgroundColor: "#1a1a1a",
    color: "#f0f0f0" as const,
    borderColor: focusedField === field ? colors.primary : "transparent",
    fontFamily: "DMSans_400Regular",
  });

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: "#0a0a0a" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: colors.primary, fontFamily: "DMSans_700Bold" }]}>
            vibe
          </Text>
          <Text style={[styles.tagline, { color: "#555", fontFamily: "DMSans_400Regular" }]}>
            no AI slop. no rage bait. just real people.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, inputStyle("username")]}
            placeholder="Username"
            placeholderTextColor="#555"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, inputStyle("email")]}
            placeholder="Email"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, inputStyle("password")]}
            placeholder="Password (6+ characters)"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.btnPrimaryText, { color: "#fff", fontFamily: "DMSans_600SemiBold" }]}>
                Create account
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: "#555", fontFamily: "DMSans_400Regular" }]}>
            Already have an account?
          </Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={[styles.linkText, { color: colors.primary, fontFamily: "DMSans_600SemiBold" }]}>
              {" "}Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: 28, gap: 52 },
  header: { alignItems: "center", gap: 10 },
  wordmark: { fontSize: 56, letterSpacing: -2 },
  tagline: { fontSize: 14, textAlign: "center" },
  form: { gap: 12 },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1.5,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { fontSize: 15 },
  linkText: { fontSize: 15 },
});
