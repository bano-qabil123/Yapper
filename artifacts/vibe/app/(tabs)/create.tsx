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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaBase64(result.assets[0].base64 ?? null);
    }
  };

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert("Empty post", "Write something first.");
      return;
    }
    if (!user) return;
    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let media_url: string | null = null;

    if (mediaBase64 && mediaUri) {
      const ext = mediaUri.split(".").pop() ?? "jpg";
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      const { data, error } = await supabase.storage
        .from("media")
        .upload(fileName, decode(mediaBase64), { contentType, upsert: true });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        media_url = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content: content.trim(),
      media_url,
    });

    setPosting(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setContent("");
      setMediaUri(null);
      setMediaBase64(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  function decode(base64: string): Uint8Array {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  const charCount = content.length;
  const maxChars = 500;
  const overLimit = charCount > maxChars;

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
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
          New post
        </Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={posting || overLimit || !content.trim()}
          style={[
            styles.postBtn,
            {
              backgroundColor:
                posting || overLimit || !content.trim() ? colors.secondary : colors.primary,
            },
          ]}
          activeOpacity={0.85}
        >
          {posting ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.postBtnText,
                {
                  color: posting || overLimit || !content.trim()
                    ? colors.mutedForeground
                    : colors.primaryForeground,
                  fontFamily: "DMSans_600SemiBold",
                },
              ]}
            >
              Post
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authorRow}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person" size={20} color={colors.mutedForeground} />
            </View>
          )}
          <Text style={[styles.username, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
            {profile?.username ?? "you"}
          </Text>
        </View>

        <TextInput
          style={[styles.input, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}
          placeholder="What's on your mind? No AI slop, no rage bait."
          placeholderTextColor={colors.mutedForeground}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          autoFocus
        />

        {mediaUri && (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: mediaUri }} style={styles.mediaImage} resizeMode="cover" />
            <TouchableOpacity
              style={[styles.removeMedia, { backgroundColor: colors.card }]}
              onPress={() => {
                setMediaUri(null);
                setMediaBase64(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
            <Feather name="image" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text
            style={[
              styles.charCount,
              {
                color: overLimit ? colors.destructive : colors.mutedForeground,
                fontFamily: "DMSans_400Regular",
              },
            ]}
          >
            {charCount}/{maxChars}
          </Text>
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
  title: { fontSize: 18 },
  postBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  postBtnText: { fontSize: 15 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { fontSize: 14 },
  input: { fontSize: 17, lineHeight: 25, minHeight: 120 },
  mediaPreview: { borderRadius: 12, overflow: "hidden", position: "relative" },
  mediaImage: { width: "100%", height: 200, borderRadius: 12 },
  removeMedia: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  charCount: { fontSize: 13 },
});
