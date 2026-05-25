import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const APP_VERSION = "1.0.0";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(profile?.push_notifications ?? true);
  const [savingPush, setSavingPush] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const handleChangePassword = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Email sent", `A password reset link was sent to ${user.email}`);
    }
  };

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);
    setSavingPush(true);
    await supabase.from("profiles").update({ push_notifications: value }).eq("id", user!.id);
    setSavingPush(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account and all your posts. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              `Type your username to confirm: @${profile?.username}`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete forever",
                  style: "destructive",
                  onPress: async () => {
                    if (!user) return;
                    setDeletingAccount(true);
                    await supabase.from("profiles").delete().eq("id", user.id);
                    await signOut();
                    setDeletingAccount(false);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const Section = ({ title }: { title: string }) => (
    <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "DMSans_600SemiBold" }]}>
      {title.toUpperCase()}
    </Text>
  );

  const SettingRow = ({
    icon,
    label,
    onPress,
    rightElement,
    destructive,
    description,
  }: {
    icon: string;
    label: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
    description?: string;
  }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.iconWrap, { backgroundColor: destructive ? "#ef444422" : colors.secondary }]}>
        <Feather name={icon as any} size={17} color={destructive ? "#ef4444" : colors.foreground} />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[
            styles.rowLabel,
            { color: destructive ? "#ef4444" : colors.foreground, fontFamily: "DMSans_500Medium" },
          ]}
        >
          {label}
        </Text>
        {description && (
          <Text style={[styles.rowDesc, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            {description}
          </Text>
        )}
      </View>
      {rightElement ?? (onPress ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} /> : null)}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
          Settings
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 6, paddingBottom: insets.bottom + 40 }}>
        <Section title="Account" />
        <View style={[styles.group, { borderColor: colors.border }]}>
          <SettingRow icon="edit-2" label="Edit Profile" onPress={() => router.push("/edit-profile")} />
          <SettingRow icon="lock" label="Change Password" onPress={handleChangePassword} description="Sends a reset link to your email" />
          {!profile?.verified && (
            <SettingRow
              icon="award"
              label="Request Verification"
              onPress={() => router.push({ pathname: "/user/[id]", params: { id: user?.id ?? "" } })}
              description="Get the verified badge"
            />
          )}
        </View>

        <Section title="Preferences" />
        <View style={[styles.group, { borderColor: colors.border }]}>
          <SettingRow
            icon="moon"
            label="Dark Mode"
            description="Always on — Vibe is dark-first"
            rightElement={
              <Switch
                value={true}
                disabled
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="bell"
            label="Push Notifications"
            rightElement={
              savingPush ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={pushEnabled}
                  onValueChange={handlePushToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#fff"
                />
              )
            }
          />
        </View>

        <Section title="About" />
        <View style={[styles.group, { borderColor: colors.border }]}>
          <SettingRow icon="info" label={`Version ${APP_VERSION}`} />
          <SettingRow icon="heart" label="Built with ❤️ as a brain-rot-free social app" description="Inspired by MystyDev" />
        </View>

        <Section title="Danger Zone" />
        <View style={[styles.group, { borderColor: "#ef444444" }]}>
          <SettingRow icon="log-out" label="Sign Out" onPress={handleSignOut} destructive />
          <SettingRow
            icon="trash-2"
            label="Delete Account"
            onPress={deletingAccount ? undefined : handleDeleteAccount}
            destructive
            description="Permanently deletes all your data"
            rightElement={
              deletingAccount ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Feather name="chevron-right" size={16} color="#ef4444" />
              )
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.8, marginTop: 16, marginBottom: 4, marginLeft: 4 },
  group: { borderRadius: 14, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15 },
  rowDesc: { fontSize: 12 },
});
