import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { PostCard } from "@/components/PostCard";
import { PostSkeleton } from "@/components/SkeletonLoader";
import { supabase, Post } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Tab = "all" | "following";

async function fetchPosts(tab: Tab, userId: string): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select("*, profiles(*)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (tab === "following") {
    const { data: following } = await supabase
      .from("followers")
      .select("target_user_id")
      .eq("user_id", userId);
    const ids = (following ?? []).map((f: { target_user_id: string }) => f.target_user_id);
    if (ids.length === 0) return [];
    query = query.in("user_id", ids);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  if (data.length === 0) return [];

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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const data = await fetchPosts(activeTab, user.id);
        setPosts(data);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, user]
  );

  useEffect(() => {
    load();
  }, [load]);

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
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 10,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.wordmark, { color: colors.primary, fontFamily: "DMSans_700Bold" }]}>
          vibe
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
                {t === "all" ? "All Feed" : "Following"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View>
          {[1, 2, 3, 4].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} onLikeToggle={handleLikeToggle} />
          )}
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
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
                {activeTab === "following" ? "Follow people to see their posts" : "No posts yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                {activeTab === "following"
                  ? "Find interesting people in Search"
                  : "Be the first to post something real"}
              </Text>
            </View>
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  wordmark: { fontSize: 26, letterSpacing: -1 },
  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pillText: { fontSize: 14 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptyTitle: { fontSize: 16, textAlign: "center" },
  emptyText: { fontSize: 14, textAlign: "center" },
});
