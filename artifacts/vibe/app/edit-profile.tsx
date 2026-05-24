import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!username.trim()) {
      Alert.alert("Username required");
      return;
    }
    if (username.includes(" ")) {
      Alert.alert("Invalid username", "No spaces allowed.");
      return;
    }

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let avatar_url = profile?.avatar_url ?? null;

    if (avatarBase64 && avatarUri && !avatarUri.startsWith("http")) {
      const ext = avatarUri.split(".").pop() ?? "jpg";
      const fileName = `avatars/${user.id}.${ext}`;
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

      function decode(base64: string): Uint8Array {
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return bytes;
      }

      const { data, error } = await supabase.storage
        .from("media")
        .upload(fileName, decode(avatarBase64), { contentType, upsert: true });

      if (!error && data) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        avatar_url = urlData.publicUrl;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        avatar_url,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
          Edit profile
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: saving ? colors.secondary : colors.primary }]}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground, fontFamily: "DMSans_600SemiBold" }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 24 },
        ]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
                <Ionicons name="person" size={36} color={colors.mutedForeground} />
              </View>
            )}
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={14} color={colors.primaryForeground} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.changePhotoText, { color: colors.primary, fontFamily: "DMSans_500Medium" }]}>
            Change photo
          </Text>
        </View>

        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
              Username
            </Text>
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
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="username"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
              Bio
            </Text>
            <TextInput
              style={[
                styles.bioInput,
                {
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                  fontFamily: "DMSans_400Regular",
                },
              ]}
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="Tell the world what you're about..."
              placeholderTextColor={colors.mutedForeground}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              {bio.length}/200
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>
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
  title: { fontSize: 17 },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: { fontSize: 14 },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 28 },
  avatarSection: { alignItems: "center", gap: 10 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: { fontSize: 14 },
  fields: { gap: 20 },
  field: { gap: 6 },
  label: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  bioInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 100,
  },
  charCount: { fontSize: 12, textAlign: "right" },
});
