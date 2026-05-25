import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { NotificationBadgeProvider } from "@/context/NotificationBadgeContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function SplashOverlay({ onDone }: { onDone: () => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const nameOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }).start();
    Animated.timing(logoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => Animated.timing(nameOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start(), 400);
    setTimeout(() => Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start(), 700);
    setTimeout(() => {
      Animated.timing(overlayOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => onDone());
    }, 2000);
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: "#090909", opacity: overlayOpacity, alignItems: "center", justifyContent: "center", zIndex: 9999 }]}
    >
      <Animated.View
        style={{
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: "#7c3aed",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoOpacity,
          transform: [{ scale }],
        }}
      >
        <Text style={{ fontSize: 44 }}>⚡</Text>
      </Animated.View>
      <Animated.Text style={{ opacity: nameOpacity, color: "#fff", fontSize: 38, fontFamily: "DMSans_700Bold", marginTop: 16, letterSpacing: -1 }}>
        Vibe
      </Animated.Text>
      <Animated.Text style={{ opacity: taglineOpacity, color: "#a1a1aa", fontSize: 14, marginTop: 8, fontFamily: "DMSans_400Regular" }}>
        No slop. Just real people.
      </Animated.Text>
    </Animated.View>
  );
}

function OnboardingGate() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (profile && profile.onboarded === false) {
      router.replace("/onboarding");
    }
  }, [profile]);

  return null;
}

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  if (loading) return null;

  if (!session) {
    return (
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
        </Stack>
        {!splashDone && <SplashOverlay onDone={() => setSplashDone(true)} />}
      </View>
    );
  }

  return (
    <NotificationBadgeProvider>
      <View style={{ flex: 1 }}>
        <OnboardingGate />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="settings" />
        </Stack>
        {!splashDone && <SplashOverlay onDone={() => setSplashDone(true)} />}
      </View>
    </NotificationBadgeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
