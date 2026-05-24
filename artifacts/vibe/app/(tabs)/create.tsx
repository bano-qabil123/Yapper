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
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { GifPicker } from "@/components/GifPicker";

type MediaItem = {
  uri: string;
  base64?: string | null;
  isGif?: boolean;
  gifUrl?: string;
};

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [posting, setPosting] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const MAX_CHARS = 500;
  const charCount = content.length;
  const overLimit = charCount > MAX_CHARS;
  const canPost = (content.trim().length > 0 || mediaItems.length > 0) && !overLimit;

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
      selectionLimit: 4,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newItems: MediaItem[] = result.assets.map((a) => ({
        uri: a.uri,
        base64: a.base64,
      }));
      setMediaItems((prev) => [...prev, ...newItems].slice(0, 4));
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const insertHashtag = () => {
    setContent((c) => (c.endsWith(" ") || c === "" ? c + "#" : c + " #"));
  };

  const insertMention = () => {
    setContent((c) => (c.endsWith(" ") || c === "" ? c + "@" : c + " @"));
  };

  function decode(base64: string): Uint8Array {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  const handlePost = async () => {
    if (!canPost) return;
    if (!user) return;
    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const uploadedUrls: string[] = [];

    for (const item of mediaItems) {
      if (item.isGif && item.gifUrl) {
        uploadedUrls.push(item.gifUrl);
        continue;
      }
      if (item.base64 && item.uri) {
        const ext = item.uri.split(".").pop()?.split("?")[0] ?? "jpg";
        const safeExt = ext === "jpg" ? "jpeg" : ext;
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const contentType = `image/${safeExt}`;
        const { data, error } = await supabase.storage
          .from("media")
          .upload(fileName, decode(item.base64), { contentType, upsert: true });
        if (!error && data) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
          uploadedUrls.push(urlData.publicUrl);
        }
      }
    }

    const media_url = uploadedUrls.length > 0 ? uploadedUrls.join(",") : null;

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
      setMediaItems([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Posted!", "Your post is live.");
    }
  };

  const charColor =
    charCount > MAX_CHARS
      ? colors.destructive
      : charCount > MAX_CHARS * 0.85
      ? "#f59e0b"
      : colors.mutedForeground;

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
          New Post
        </Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={posting || !canPost}
          style={[
            styles.postBtn,
            { backgroundColor: canPost && !posting ? colors.primary : colors.secondary },
          ]}
          activeOpacity={0.85}
        >
          {posting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              style={[
                styles.postBtnText,
                {
                  color: canPost ? "#fff" : colors.mutedForeground,
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

        {mediaItems.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaPreviews}
          >
            {mediaItems.map((item, index) => (
              <View key={index} style={styles.mediaThumbWrap}>
                <Image source={{ uri: item.uri }} style={styles.mediaThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={[styles.removeBtn, { backgroundColor: "rgba(0,0,0,0.7)" }]}
                  onPress={() => removeMedia(index)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
                {item.isGif && (
                  <View style={styles.gifLabel}>
                    <Text style={styles.gifLabelText}>GIF</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
          <View style={styles.toolbarLeft}>
            <TouchableOpacity onPress={pickImages} activeOpacity={0.7} style={styles.toolBtn}>
              <Feather name="image" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowGifPicker(true)} activeOpacity={0.7} style={styles.toolBtn}>
              <Text style={[styles.gifBtnText, { color: colors.mutedForeground, fontFamily: "DMSans_700Bold" }]}>
                GIF
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={insertHashtag} activeOpacity={0.7} style={styles.toolBtn}>
              <Feather name="hash" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={insertMention} activeOpacity={0.7} style={styles.toolBtn}>
              <Feather name="at-sign" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.charCount, { color: charColor, fontFamily: "DMSans_400Regular" }]}>
            {charCount}/{MAX_CHARS}
          </Text>
        </View>
      </KeyboardAwareScrollView>

      <GifPicker
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={(gif) => {
          setMediaItems((prev) =>
            [...prev, { uri: gif.preview, isGif: true, gifUrl: gif.url }].slice(0, 4)
          );
        }}
      />
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
  scrollContent: { padding: 16, gap: 14, paddingBottom: 40 },
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
  mediaPreviews: { gap: 8, paddingBottom: 4 },
  mediaThumbWrap: { position: "relative", marginRight: 2 },
  mediaThumb: { width: 100, height: 100, borderRadius: 8 },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  gifLabel: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  gifLabelText: { color: "#fff", fontSize: 10, fontFamily: "DMSans_700Bold" },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarLeft: { flexDirection: "row", gap: 4 },
  toolBtn: { padding: 8 },
  gifBtnText: { fontSize: 13 },
  charCount: { fontSize: 13 },
});
