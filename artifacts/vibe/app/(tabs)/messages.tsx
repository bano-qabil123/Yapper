import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { supabase, Message, Profile } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useNotificationBadge } from "@/context/NotificationBadgeContext";
import { UserBadge } from "@/components/UserBadge";

type Conversation = {
  otherId: string;
  otherProfile: Profile | null;
  lastMessage: Message;
  unreadCount: number;
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { refreshDm } = useNotificationBadge();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const load = useCallback(async (silent = false) => {
    if (!user) { setLoading(false); return; }
    if (!silent) setLoading(true);

    const { data, error } = await supabase
      .from("messages")
      .select(
        "*, sender:profiles!messages_sender_id_fkey(id, username, display_name, avatar_url, verified), receiver:profiles!messages_receiver_id_fkey(id, username, display_name, avatar_url, verified)"
      )
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("[Messages] error:", error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const seen = new Set<string>();
    const unreadBucket: Record<string, number> = {};
    const convMap: Record<string, Message> = {};

    for (const msg of (data ?? []) as Message[]) {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!convMap[otherId]) {
        convMap[otherId] = msg;
      }
      if (!msg.read && msg.receiver_id === user.id) {
        unreadBucket[otherId] = (unreadBucket[otherId] ?? 0) + 1;
      }
      seen.add(otherId);
    }

    const convList: Conversation[] = Array.from(seen).map((otherId) => {
      const msg = convMap[otherId];
      const isFromMe = msg.sender_id === user.id;
      return {
        otherId,
        otherProfile: (isFromMe ? msg.receiver : msg.sender) as Profile | null,
        lastMessage: msg,
        unreadCount: unreadBucket[otherId] ?? 0,
      };
    });

    setConversations(convList);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => {
    load();
    refreshDm();
  }, [load, refreshDm]));

  const ConversationRow = ({ item }: { item: Conversation }) => {
    const isFromMe = item.lastMessage.sender_id === user?.id;
    const preview = isFromMe
      ? `You: ${item.lastMessage.content}`
      : item.lastMessage.content;

    return (
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: item.unreadCount > 0 ? colors.primary + "0d" : "transparent",
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.otherId } })}
        activeOpacity={0.8}
      >
        <View style={styles.avatarWrap}>
          {item.otherProfile?.avatar_url ? (
            <Image source={{ uri: item.otherProfile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person" size={22} color={colors.mutedForeground} />
            </View>
          )}
          {item.unreadCount > 0 && (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          )}
        </View>

        <View style={styles.info}>
          <View style={styles.topRow}>
            <UserBadge
              username={item.otherProfile?.username ?? "unknown"}
              verified={item.otherProfile?.verified ?? false}
            />
            <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              {timeAgo(item.lastMessage.created_at)}
            </Text>
          </View>
          <Text
            style={[
              styles.preview,
              {
                color: item.unreadCount > 0 ? colors.foreground : colors.mutedForeground,
                fontFamily: item.unreadCount > 0 ? "DMSans_500Medium" : "DMSans_400Regular",
              },
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>

        {item.unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { fontFamily: "DMSans_700Bold" }]}>
              {item.unreadCount > 9 ? "9+" : item.unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
          Messages
        </Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/search")}
          activeOpacity={0.85}
        >
          <Feather name="edit" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.otherId}
          renderItem={({ item }) => <ConversationRow item={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
                No messages yet
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                Find someone in Search and send them a message
              </Text>
            </View>
          }
          contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : { paddingBottom: 120 }}
        />
      )}
    </View>
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
  title: { fontSize: 22 },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  unreadDot: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6 },
  info: { flex: 1, gap: 4 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontSize: 12 },
  preview: { fontSize: 14, lineHeight: 18 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, color: "#fff" },
  empty: { padding: 60, alignItems: "center", gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
