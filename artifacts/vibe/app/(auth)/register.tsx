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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (username.includes(" ")) {
      Alert.alert("Invalid username", "Username cannot contain spaces.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      Alert.alert("Invalid username", "Only letters, numbers, and underscores.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", "Please check your password confirmation.");
      return;
    }

    setLoading(true);
    console.log("[Register] Signing up user:", email, "username:", username);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.toLowerCase() },
      },
    });

    if (error) {
      setLoading(false);
      console.error("[Register] Signup error:", error.message);
      Alert.alert("Sign up failed", error.message);
      return;
    }

    console.log("[Register] Signup success, user id:", data.user?.id);
    setLoading(false);
  };

  const inputStyle = (field: string) => [
    styles.input,
    {
      backgroundColor: colors.input,
      color: colors.foreground,
      borderColor: focused === field ? colors.primary : colors.border,
      fontFamily: "DMSans_400Regular",
    } as const,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoEmoji}>⚡</Text>
          </View>
          <Text style={[styles.appName, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
            Vibe
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            Create your account
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={inputStyle("username")}
            placeholder="Username"
            placeholderTextColor={colors.mutedForeground}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            onFocus={() => setFocused("username")}
            onBlur={() => setFocused(null)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={inputStyle("email")}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused(null)}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={inputStyle("password")}
            placeholder="Password (6+ characters)"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            secureTextEntry
          />
          <TextInput
            style={inputStyle("confirm")}
            placeholder="Confirm password"
            placeholderTextColor={colors.mutedForeground}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onFocus={() => setFocused("confirm")}
            onBlur={() => setFocused(null)}
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
              <Text style={[styles.btnPrimaryText, { fontFamily: "DMSans_600SemiBold" }]}>
                Create account
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
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
  container: { paddingHorizontal: 24, gap: 36 },
  logoSection: { alignItems: "center", gap: 12 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 34 },
  appName: { fontSize: 40, letterSpacing: -1 },
  tagline: { fontSize: 15, textAlign: "center" },
  form: { gap: 12 },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16, color: "#fff" },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { fontSize: 15 },
  linkText: { fontSize: 15 },
});
