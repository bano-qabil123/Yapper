import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { supabase, Post, Profile } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { PostCard } from "@/components/PostCard";
import { UserBadge } from "@/components/UserBadge";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<Profile[]>([]);
  const [followingList, setFollowingList] = useState<Profile[]>([]);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const load = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);

      const [{ data: postData }, { count: fwrCount }, { count: fwingCount }] = await Promise.all([
        supabase
          .from("posts")
          .select("*, profiles(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("target_user_id", user.id),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      const pids = (postData ?? []).map((p: Post) => p.id);
      const [{ data: likes }, { data: likesByUser }, { data: comments }] = await Promise.all([
        supabase.from("likes").select("post_id").in("post_id", pids),
        supabase.from("likes").select("post_id").in("post_id", pids).eq("user_id", user.id),
        supabase.from("comments").select("post_id").in("post_id", pids),
      ]);
      const likeCounts: Record<string, number> = {};
      (likes ?? []).forEach((l: { post_id: string }) => { likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1; });
      const likedSet = new Set((likesByUser ?? []).map((l: { post_id: string }) => l.post_id));
      const commentCounts: Record<string, number> = {};
      (comments ?? []).forEach((c: { post_id: string }) => { commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1; });

      setPosts(
        (postData ?? []).map((p: Post) => ({
          ...p,
          likes_count: likeCounts[p.id] ?? 0,
          comments_count: commentCounts[p.id] ?? 0,
          is_liked: likedSet.has(p.id),
        }))
      );
      setFollowerCount(fwrCount ?? 0);
      setFollowingCount(fwingCount ?? 0);
      setLoading(false);
      setRefreshing(false);
    },
    [user]
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadFollowers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("followers")
      .select("profiles!followers_user_id_fkey(*)")
      .eq("target_user_id", user.id);
    setFollowersList((data ?? []).map((d: { profiles: Profile }) => d.profiles));
    setShowFollowers(true);
  };

  const loadFollowing = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("followers")
      .select("profiles!followers_target_user_id_fkey(*)")
      .eq("user_id", user.id);
    setFollowingList((data ?? []).map((d: { profiles: Profile }) => d.profiles));
    setShowFollowing(true);
  };

  const handleLikeToggle = useCallback((postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, is_liked: liked, likes_count: (p.likes_count ?? 0) + (liked ? 1 : -1) } : p
      )
    );
  }, []);

  const ProfileListModal = ({
    visible,
    title,
    data,
    onClose,
  }: {
    visible: boolean;
    title: string;
    data: Profile[];
    onClose: () => void;
  }) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.userRow, { borderBottomColor: colors.border }]}
              onPress={() => {
                onClose();
                if (item.id === user?.id) return;
                router.push({ pathname: "/user/[id]", params: { id: item.id } });
              }}
              activeOpacity={0.8}
            >
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.miniAvatar} />
              ) : (
                <View style={[styles.miniAvatarPlaceholder, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="person" size={16} color={colors.mutedForeground} />
                </View>
              )}
              <UserBadge username={item.username} verified={item.verified} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                None yet
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} onLikeToggle={handleLikeToggle} />}
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
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.header,
                { paddingTop: topPad + 12, borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => router.push("/edit-profile")}
                  style={[styles.editBtn, { borderColor: colors.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.editBtnText, { color: colors.foreground, fontFamily: "DMSans_500Medium" }]}>
                    Edit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={signOut} activeOpacity={0.7}>
                  <Feather name="log-out" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="person" size={36} color={colors.mutedForeground} />
                </View>
              )}

              <UserBadge username={profile?.username ?? ""} verified={profile?.verified ?? false} size="lg" />

              {profile?.bio && (
                <Text style={[styles.bio, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}>
                  {profile.bio}
                </Text>
              )}

              <View style={styles.stats}>
                <TouchableOpacity style={styles.stat} onPress={loadFollowers} activeOpacity={0.8}>
                  <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
                    {followerCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                    Followers
                  </Text>
                </TouchableOpacity>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.stat} onPress={loadFollowing} activeOpacity={0.8}>
                  <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
                    {followingCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                    Following
                  </Text>
                </TouchableOpacity>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
                    {posts.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                    Posts
                  </Text>
                </View>
              </View>
            </View>

            {posts.length === 0 && !loading && (
              <View style={styles.empty}>
                <Feather name="edit-3" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
                  Share something real
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                  Your posts live here
                </Text>
              </View>
            )}
          </View>
        }
        scrollEnabled={!!posts.length}
      />

      <ProfileListModal
        visible={showFollowers}
        title="Followers"
        data={followersList}
        onClose={() => setShowFollowers(false)}
      />
      <ProfileListModal
        visible={showFollowing}
        title="Following"
        data={followingList}
        onClose={() => setShowFollowing(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
    gap: 14,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 14 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginTop: 4 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  bio: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: "85%" },
  stats: { flexDirection: "row", alignItems: "center", gap: 0 },
  stat: { alignItems: "center", paddingHorizontal: 24, gap: 2 },
  statNum: { fontSize: 18 },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 30 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  miniAvatar: { width: 40, height: 40, borderRadius: 20 },
  miniAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { padding: 40, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
