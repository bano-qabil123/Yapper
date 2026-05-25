import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { supabase, Message, Profile } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useNotificationBadge } from "@/context/NotificationBadgeContext";
import { UserBadge } from "@/components/UserBadge";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: otherId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { refreshDm } = useNotificationBadge();
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!user || !otherId) return;

    const [{ data: profileData }, { data: msgData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", otherId).single(),
      supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true }),
    ]);

    setOtherProfile(profileData as Profile);
    setMessages((msgData as Message[]) ?? []);
    setLoading(false);

    // Mark all incoming messages as read
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("sender_id", otherId)
      .eq("receiver_id", user.id)
      .eq("read", false);
    refreshDm();
  }, [user, otherId, refreshDm]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !otherId) return;

    const channel = supabase
      .channel(`chat:${[user.id, otherId].sort().join("_")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as Message;
          const isRelevant =
            (msg.sender_id === user.id && msg.receiver_id === otherId) ||
            (msg.sender_id === otherId && msg.receiver_id === user.id);
          if (!isRelevant) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // If received, mark as read immediately
          if (msg.receiver_id === user.id) {
            await supabase.from("messages").update({ read: true }).eq("id", msg.id);
            refreshDm();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, otherId, refreshDm]);

  const handleSend = async () => {
    if (!text.trim() || !user || !otherId) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: otherId,
      content: text.trim(),
      read: false,
    });

    if (!error) {
      setText("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setSending(false);
  };

  const Bubble = ({ msg }: { msg: Message }) => {
    const isMe = msg.sender_id === user?.id;
    return (
      <View style={[styles.bubbleWrap, isMe ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? colors.primary : colors.card2,
              borderBottomRightRadius: isMe ? 4 : 18,
              borderBottomLeftRadius: isMe ? 18 : 4,
            },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isMe ? "#fff" : colors.foreground, fontFamily: "DMSans_400Regular" },
            ]}
          >
            {msg.content}
          </Text>
        </View>
        <Text style={[styles.bubbleTime, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular", textAlign: isMe ? "right" : "left" }]}>
          {formatTime(msg.created_at)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          {otherProfile?.avatar_url ? (
            <Image source={{ uri: otherProfile.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person" size={14} color={colors.mutedForeground} />
            </View>
          )}
          <UserBadge username={otherProfile?.username ?? "unknown"} verified={otherProfile?.verified ?? false} />
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Bubble msg={item} />}
        contentContainerStyle={{ padding: 12, gap: 4, paddingBottom: 20 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              Start the conversation ✨
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: colors.secondary, color: colors.foreground, fontFamily: "DMSans_400Regular" },
          ]}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || !text.trim()}
          style={[
            styles.sendBtn,
            { backgroundColor: text.trim() ? colors.primary : colors.secondary },
          ]}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name="arrow-up"
              size={18}
              color={text.trim() ? "#fff" : colors.mutedForeground}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerProfile: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  bubbleWrap: { marginBottom: 2, maxWidth: "75%" },
  bubbleWrapLeft: { alignSelf: "flex-start" },
  bubbleWrapRight: { alignSelf: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTime: { fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  empty: { padding: 60, alignItems: "center" },
  emptyText: { fontSize: 14 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
});
