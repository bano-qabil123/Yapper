import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { supabase, Notification } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useNotificationBadge } from "@/context/NotificationBadgeContext";

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
  return `${Math.floor(days / 7)}w`;
}

function notifLabel(type: string): string {
  if (type === "follow") return "followed you";
  if (type === "like") return "liked your post";
  if (type === "comment") return "commented on your post";
  return "";
}

function NotifIconCircle({ type, colors }: { type: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  const iconColor = type === "like" ? "#ff4d4d" : colors.primary;
  const bgColor = type === "like" ? "#ff4d4d22" : colors.primary + "22";
  return (
    <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
      {type === "follow" && <Ionicons name="person-add" size={14} color={iconColor} />}
      {type === "like" && <Ionicons name="heart" size={14} color={iconColor} />}
      {type === "comment" && <Feather name="message-circle" size={14} color={iconColor} />}
    </View>
  );
}

type Section = { title: string; data: Notification[] };

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { markAllRead } = useNotificationBadge();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("*, profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url, verified), posts(id, content)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) console.error("[Notifs] error:", error.message);
      setNotifications((data as Notification[]) ?? []);
      setLoading(false);
      setRefreshing(false);
    },
    [user]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = async (notif: Notification) => {
    if (!notif.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      const anyUnread = notifications.some((n) => !n.read && n.id !== notif.id);
      if (!anyUnread) markAllRead();
    }
    if (notif.type === "follow") {
      router.push({ pathname: "/user/[id]", params: { id: notif.actor_id } });
    } else if (notif.post_id) {
      router.push({ pathname: "/post/[id]", params: { id: notif.post_id } });
    }
  };

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newNotifs = notifications.filter((n) => !n.read || new Date(n.created_at).getTime() > cutoff);
  const earlierNotifs = notifications.filter((n) => n.read && new Date(n.created_at).getTime() <= cutoff);

  const sections: Section[] = [];
  if (newNotifs.length > 0) sections.push({ title: "New", data: newNotifs });
  if (earlierNotifs.length > 0) sections.push({ title: "Earlier", data: earlierNotifs });

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: item.read ? "transparent" : colors.primary + "10",
          borderBottomColor: colors.border,
        },
      ]}
      onPress={() => handlePress(item)}
      activeOpacity={0.85}
    >
      {/* Avatar + icon overlay */}
      <View style={styles.avatarWrap}>
        {item.profiles?.avatar_url ? (
          <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
            <Ionicons name="person" size={18} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.iconBadge}>
          <NotifIconCircle type={item.type} colors={colors} />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.textRow}>
          <Text style={[styles.text, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}>
            <Text style={{ fontFamily: "DMSans_600SemiBold" }}>
              {item.profiles?.username ?? "someone"}
            </Text>
            {"  "}
            {notifLabel(item.type)}
          </Text>
          <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
        {item.posts?.content && (
          <Text
            style={[styles.postPreview, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}
            numberOfLines={1}
          >
            {item.posts.content}
          </Text>
        )}
      </View>

      {!item.read && (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
      )}
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground, fontFamily: "DMSans_600SemiBold" }]}>
        {section.title}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
          Notifications
        </Text>
      </View>

      {!loading && sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="bell" size={40} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
            All caught up
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            When someone engages with your posts, it'll show up here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.primary}
            />
          }
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -6,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 3 },
  textRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  text: { fontSize: 14, lineHeight: 20, flex: 1 },
  time: { fontSize: 12, flexShrink: 0, marginTop: 2 },
  postPreview: { fontSize: 13 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignSelf: "center",
    flexShrink: 0,
  },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 40 },
  emptyTitle: { fontSize: 16 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
