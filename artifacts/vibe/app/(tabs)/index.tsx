import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { PostCard } from "@/components/PostCard";
import { PostSkeleton } from "@/components/SkeletonLoader";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useNotificationBadge } from "@/context/NotificationBadgeContext";

type Tab = "all" | "following";

async function fetchSinglePost(postId: string, userId: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*, author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, bio, verified)")
    .eq("id", postId)
    .single();
  if (error || !data) return null;

  const [{ data: likes }, { data: likesByUser }, { data: comments }] = await Promise.all([
    supabase.from("likes").select("post_id").eq("post_id", postId),
    supabase.from("likes").select("post_id").eq("post_id", postId).eq("user_id", userId),
    supabase.from("comments").select("post_id").eq("post_id", postId),
  ]);

  return {
    ...data,
    likes_count: likes?.length ?? 0,
    comments_count: comments?.length ?? 0,
    is_liked: (likesByUser?.length ?? 0) > 0,
  } as Post;
}

async function fetchPosts(tab: Tab, userId: string): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select("*, author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, bio, verified)")
    .order("created_at", { ascending: false })
    .limit(40);

  if (tab === "following") {
    const { data: following, error: fwErr } = await supabase
      .from("followers")
      .select("target_user_id")
      .eq("user_id", userId);
    if (fwErr) console.warn("[Feed] followers error:", fwErr.message);
    const ids = (following ?? []).map((f: { target_user_id: string }) => f.target_user_id);
    if (ids.length === 0) return [];
    query = query.in("user_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Feed] posts query error:", error.message, "code:", error.code);
    return [];
  }
  if (!data || data.length === 0) {
    console.log("[Feed] No posts returned");
    return [];
  }
  console.log("[Feed] Got", data.length, "posts");

  const postIds = data.map((p: Post) => p.id);
  const [{ data: likes }, { data: likesByUser }, { data: comments }] = await Promise.all([
    supabase.from("likes").select("post_id").in("post_id", postIds),
    supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", userId),
    supabase.from("comments").select("post_id").in("post_id", postIds),
  ]);

  const likeCounts: Record<string, number> = {};
  (likes ?? []).forEach((l: { post_id: string }) => {
    likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1;
  });
  const likedSet = new Set((likesByUser ?? []).map((l: { post_id: string }) => l.post_id));
  const commentCounts: Record<string, number> = {};
  (comments ?? []).forEach((c: { post_id: string }) => {
    commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
  });

  return data.map((p: Post) => ({
    ...p,
    likes_count: likeCounts[p.id] ?? 0,
    comments_count: commentCounts[p.id] ?? 0,
    is_liked: likedSet.has(p.id),
  }));
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { unreadCount } = useNotificationBadge();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!user) { setLoading(false); return; }
      if (!silent) setLoading(true);
      try {
        const data = await fetchPosts(activeTab, user.id);
        setPosts(data);
      } catch (err) {
        console.error("[Feed] fetch threw:", err);
        setPosts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, user]
  );

  useEffect(() => { load(); }, [load]);

  // Realtime new-post subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("public:posts:feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const newPost = await fetchSinglePost(payload.new.id as string, user.id);
          if (newPost) {
            setPosts((prev) => {
              if (prev.some((p) => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleLikeToggle = useCallback((postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, is_liked: liked, likes_count: (p.likes_count ?? 0) + (liked ? 1 : -1) }
          : p
      )
    );
  }, []);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.wordmark, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
          Vibe <Text style={{ color: colors.primary }}>⚡</Text>
        </Text>

        <View style={styles.pillRow}>
          {(["all", "following"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setActiveTab(t)}
              style={[
                styles.pill,
                activeTab === t
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.secondary },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.pillText,
                  {
                    color: activeTab === t ? "#fff" : colors.mutedForeground,
                    fontFamily: activeTab === t ? "DMSans_600SemiBold" : "DMSans_400Regular",
                  },
                ]}
              >
                {t === "all" ? "All" : "Following"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/notifications")}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={22} color={colors.foreground} />
            {unreadCount > 0 && <View style={[styles.bellDot, { backgroundColor: colors.destructive }]} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.8}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { backgroundColor: colors.secondary }]}>
                <Ionicons name="person" size={14} color={colors.mutedForeground} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View>
          {[1, 2, 3, 4].map((i) => <PostSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} onLikeToggle={handleLikeToggle} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✦</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
                {activeTab === "following" ? "Follow people to see their posts" : "No posts yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                {activeTab === "following"
                  ? "Find people in Search"
                  : "Be the first to post something real"}
              </Text>
            </View>
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : { paddingBottom: 120 }}
        />
      )}

      {/* Floating create button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 70 }]}
        onPress={() => router.push("/(tabs)/create")}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
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
  wordmark: { fontSize: 20, letterSpacing: -0.5 },
  pillRow: { flexDirection: "row", gap: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99 },
  pillText: { fontSize: 13 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerBtn: { position: "relative" },
  bellDot: { position: "absolute", top: -1, right: -2, width: 8, height: 8, borderRadius: 4 },
  headerAvatar: { width: 30, height: 30, borderRadius: 15 },
  headerAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", gap: 8, padding: 40 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptyIcon: { fontSize: 32, color: "#3b82f6" },
  emptyTitle: { fontSize: 16, textAlign: "center" },
  emptyText: { fontSize: 14, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
