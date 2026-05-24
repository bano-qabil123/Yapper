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
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.wordmark, { color: colors.primary, fontFamily: "DMSans_700Bold" }]}>
            vibe
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            share what you actually care about
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.foreground,
                borderColor: colors.border,
                fontFamily: "DMSans_400Regular",
              },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.foreground,
                borderColor: colors.border,
                fontFamily: "DMSans_400Regular",
              },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground, fontFamily: "DMSans_600SemiBold" }]}>
                Sign in
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
            <Text style={[styles.forgotText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
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
  container: { paddingHorizontal: 28, gap: 48 },
  header: { alignItems: "center", gap: 8 },
  wordmark: { fontSize: 52, letterSpacing: -2 },
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
  btnPrimaryText: { fontSize: 16 },
  forgotText: { fontSize: 14, textAlign: "center", marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "center" },
  footerText: { fontSize: 15 },
  linkText: { fontSize: 15 },
});
