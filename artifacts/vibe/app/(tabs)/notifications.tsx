import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
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
import { UserBadge } from "@/components/UserBadge";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "follow") return <Ionicons name="person-add" size={14} color="#7c5cfc" />;
  if (type === "comment") return <Feather name="message-circle" size={14} color="#7c5cfc" />;
  if (type === "like") return <Ionicons name="heart" size={14} color="#ff453a" />;
  return null;
}

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
      const { data } = await supabase
        .from("notifications")
        .select("*, profiles!notifications_actor_id_fkey(*), posts(id, content)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      setNotifications((data as Notification[]) ?? []);
      setLoading(false);
      setRefreshing(false);

      if (data) {
        const unread = data.filter((n: Notification) => !n.read).map((n: Notification) => n.id);
        if (unread.length > 0) {
          await supabase.from("notifications").update({ read: true }).in("id", unread);
          markAllRead();
        }
      }
    },
    [user, markAllRead]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = (notif: Notification) => {
    if (notif.type === "follow") {
      router.push({ pathname: "/user/[id]", params: { id: notif.actor_id } });
    } else if (notif.post_id) {
      router.push({ pathname: "/post/[id]", params: { id: notif.post_id } });
    }
  };

  const renderNotif = ({ item }: { item: Notification }) => {
    const label =
      item.type === "follow"
        ? "followed you"
        : item.type === "like"
        ? "liked your post"
        : "commented on your post";

    return (
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: item.read ? "transparent" : colors.primary + "12",
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
      >
        <View style={styles.iconWrap}>
          {item.profiles?.avatar_url ? (
            <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person" size={18} color={colors.mutedForeground} />
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <NotifIcon type={item.type} />
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.text, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}>
            <Text style={{ fontFamily: "DMSans_600SemiBold" }}>
              {item.profiles?.username ?? "someone"}
            </Text>{" "}
            {label}
          </Text>
          {item.posts?.content && (
            <Text
              style={[styles.postPreview, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}
              numberOfLines={1}
            >
              {item.posts.content}
            </Text>
          )}
          <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            {timeAgo(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotif}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Feather name="bell" size={40} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
                All caught up
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                When someone follows or engages with your posts, it'll show up here.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
      />
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
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: { position: "relative" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 3 },
  text: { fontSize: 14, lineHeight: 20 },
  postPreview: { fontSize: 13 },
  time: { fontSize: 12 },
  empty: { padding: 40, alignItems: "center", gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptyTitle: { fontSize: 16 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
