import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { supabase, Post, Profile } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { PostCard } from "@/components/PostCard";
import { UserBadge } from "@/components/UserBadge";

type SearchTab = "posts" | "users";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? "");
  const [activeTab, setActiveTab] = useState<SearchTab>("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [suggestedPeople, setSuggestedPeople] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    loadDiscovery();
  }, [user]);

  const loadDiscovery = async () => {
    if (!user) return;

    const [{ data: postData }, { data: peopleData }, { data: followingData }] = await Promise.all([
      supabase.from("posts").select("content").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("followers").select("target_user_id").eq("user_id", user.id),
    ]);

    if (postData) {
      const counts: Record<string, number> = {};
      postData.forEach(({ content }: { content: string }) => {
        const matches = content.match(/#\w+/g) ?? [];
        matches.forEach((tag: string) => {
          const t = tag.toLowerCase();
          counts[t] = (counts[t] ?? 0) + 1;
        });
      });
      setTrendingHashtags(
        Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([tag]) => tag)
      );
    }

    setSuggestedPeople((peopleData ?? []) as Profile[]);
    setFollowing(new Set((followingData ?? []).map((f: { target_user_id: string }) => f.target_user_id)));
  };

  const handleFollowToggle = async (profileId: string) => {
    if (!user) return;
    const isFollowing = following.has(profileId);
    if (isFollowing) {
      await supabase.from("followers").delete().eq("user_id", user.id).eq("target_user_id", profileId);
      setFollowing((prev) => { const s = new Set(prev); s.delete(profileId); return s; });
    } else {
      await supabase.from("followers").insert({ user_id: user.id, target_user_id: profileId });
      await supabase.from("notifications").insert({ user_id: profileId, actor_id: user.id, type: "follow", post_id: null, read: false });
      setFollowing((prev) => new Set([...prev, profileId]));
    }
  };

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) { setPosts([]); setUsers([]); return; }
      setLoading(true);
      const trimmed = q.trim();
      const [{ data: postData }, { data: userData }] = await Promise.all([
        supabase
          .from("posts")
          .select("*, profiles(id, username, display_name, avatar_url, bio, verified)")
          .ilike("content", `%${trimmed}%`)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("*")
          .or(`username.ilike.%${trimmed.replace(/^@/, "")}%,display_name.ilike.%${trimmed}%`)
          .limit(20),
      ]);

      if (postData && user) {
        const postIds = postData.map((p: Post) => p.id);
        if (postIds.length > 0) {
          const [{ data: likes }, { data: likesByUser }] = await Promise.all([
            supabase.from("likes").select("post_id").in("post_id", postIds),
            supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id),
          ]);
          const likeCounts: Record<string, number> = {};
          (likes ?? []).forEach((l: { post_id: string }) => { likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1; });
          const likedSet = new Set((likesByUser ?? []).map((l: { post_id: string }) => l.post_id));
          setPosts(postData.map((p: Post) => ({ ...p, likes_count: likeCounts[p.id] ?? 0, is_liked: likedSet.has(p.id) })));
        } else { setPosts([]); }
      }
      setUsers((userData ?? []) as Profile[]);
      setLoading(false);
    },
    [user]
  );

  useEffect(() => {
    if (params.q) { setQuery(params.q); doSearch(params.q); }
  }, [params.q]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const hasQuery = query.trim().length > 0;

  const PersonRow = ({ item }: { item: Profile }) => {
    const isF = following.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.personRow, { borderBottomColor: colors.border }]}
        onPress={() => {
          if (item.id === user?.id) router.push("/(tabs)/profile");
          else router.push({ pathname: "/user/[id]", params: { id: item.id } });
        }}
        activeOpacity={0.8}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
            <Ionicons name="person" size={20} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.personInfo}>
          <UserBadge username={item.username} verified={item.verified} />
          {item.bio && (
            <Text style={[styles.bio, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]} numberOfLines={1}>
              {item.bio}
            </Text>
          )}
        </View>
        {item.id !== user?.id && (
          <TouchableOpacity
            style={[
              styles.followBtn,
              isF
                ? { backgroundColor: "transparent", borderColor: colors.border, borderWidth: 1 }
                : { backgroundColor: colors.primary },
            ]}
            onPress={() => handleFollowToggle(item.id)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.followBtnText,
                { color: isF ? colors.mutedForeground : "#fff", fontFamily: "DMSans_600SemiBold" },
              ]}
            >
              {isF ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.secondary, borderColor: inputFocused ? colors.primary : "transparent", borderWidth: 1 },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}
            placeholder="Search posts, #hashtags, people..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => doSearch(query)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setPosts([]); setUsers([]); }} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {hasQuery && (
          <View style={[styles.tabPill, { backgroundColor: colors.secondary }]}>
            {(["posts", "users"] as SearchTab[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setActiveTab(t)}
                style={[styles.tabBtn, activeTab === t && { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === t ? "#fff" : colors.mutedForeground, fontFamily: activeTab === t ? "DMSans_600SemiBold" : "DMSans_400Regular" },
                  ]}
                >
                  {t === "posts" ? "Posts" : "People"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!hasQuery ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Trending */}
          {trendingHashtags.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "DMSans_600SemiBold" }]}>
                Trending
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                {trendingHashtags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => { setQuery(tag); doSearch(tag); }}
                    style={[styles.hashtagPill, { backgroundColor: colors.primary + "22" }]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.hashtagText, { color: colors.primary, fontFamily: "DMSans_600SemiBold" }]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Suggested people */}
          {suggestedPeople.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "DMSans_600SemiBold" }]}>
                Suggested People
              </Text>
              {suggestedPeople.map((p) => (
                <PersonRow key={p.id} item={p} />
              ))}
            </View>
          )}

          {trendingHashtags.length === 0 && suggestedPeople.length === 0 && (
            <View style={styles.emptyCenter}>
              <Feather name="search" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                Search for posts, hashtags, or people
              </Text>
            </View>
          )}
        </ScrollView>
      ) : activeTab === "posts" ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyCenter}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                  No posts found
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PersonRow item={item} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyCenter}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                  No people found
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={users.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  tabPill: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center" },
  tabText: { fontSize: 14 },
  loadingRow: { paddingTop: 20, alignItems: "center" },
  section: { paddingTop: 20, gap: 12 },
  sectionLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 16 },
  pillsRow: { gap: 8, paddingHorizontal: 16, paddingRight: 16 },
  hashtagPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  hashtagText: { fontSize: 14 },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  personInfo: { flex: 1, gap: 2 },
  bio: { fontSize: 13 },
  followBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99 },
  followBtnText: { fontSize: 13 },
  emptyCenter: { padding: 60, alignItems: "center", gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  emptyText: { fontSize: 14, textAlign: "center" },
});
