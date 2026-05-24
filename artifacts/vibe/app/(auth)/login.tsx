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

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert("Login failed", error.message);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Enter your email first", "We'll send a reset link.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Check your email", "A password reset link has been sent.");
  };

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
            share what you actually care about
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: "#1a1a1a",
                color: "#f0f0f0",
                borderColor: emailFocused ? colors.primary : "transparent",
                fontFamily: "DMSans_400Regular",
              },
            ]}
            placeholder="Email"
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: "#1a1a1a",
                color: "#f0f0f0",
                borderColor: passwordFocused ? colors.primary : "transparent",
                fontFamily: "DMSans_400Regular",
              },
            ]}
            placeholder="Password"
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.btnPrimaryText, { color: "#fff", fontFamily: "DMSans_600SemiBold" }]}>
                Sign in
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
            <Text style={[styles.forgotText, { color: "#555", fontFamily: "DMSans_400Regular" }]}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: "#555", fontFamily: "DMSans_400Regular" }]}>
            No account?
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")} activeOpacity={0.7}>
            <Text style={[styles.linkText, { color: colors.primary, fontFamily: "DMSans_600SemiBold" }]}>
              {" "}Sign up
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
  forgotText: { fontSize: 14, textAlign: "center", marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { fontSize: 15 },
  linkText: { fontSize: 15 },
});
