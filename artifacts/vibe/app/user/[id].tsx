import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { supabase, Post, Profile } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { PostCard } from "@/components/PostCard";
import { UserBadge } from "@/components/UserBadge";

export default function UserProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<Profile[]>([]);
  const [followingList, setFollowingList] = useState<Profile[]>([]);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const load = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);

    const [{ data: profileData }, { data: postData }, { count: fwrCount }, { count: fwingCount }, { data: followCheck }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase
          .from("posts")
          .select("*, author:profiles!posts_user_id_fkey(*)")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("target_user_id", id),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("followers").select("*").eq("user_id", user.id).eq("target_user_id", id),
      ]);

    setProfile(profileData as Profile);

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
    setIsFollowing((followCheck?.length ?? 0) > 0);
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFollowToggle = async () => {
    if (!user || !id) return;
    setFollowLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isFollowing) {
      await supabase.from("followers").delete().eq("user_id", user.id).eq("target_user_id", id);
      setIsFollowing(false);
      setFollowerCount((c) => c - 1);
    } else {
      await supabase.from("followers").insert({ user_id: user.id, target_user_id: id });
      await supabase.from("notifications").insert({
        user_id: id,
        actor_id: user.id,
        type: "follow",
        post_id: null,
        read: false,
      });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setFollowLoading(false);
  };

  const loadFollowers = async () => {
    const { data } = await supabase
      .from("followers")
      .select("profiles!followers_user_id_fkey(*)")
      .eq("target_user_id", id);
    setFollowersList((data ?? []).map((d: { profiles: Profile }) => d.profiles));
    setShowFollowers(true);
  };

  const loadFollowing = async () => {
    const { data } = await supabase
      .from("followers")
      .select("profiles!followers_target_user_id_fkey(*)")
      .eq("user_id", id);
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
                if (item.id === user?.id) router.push("/(tabs)/profile");
                else router.push({ pathname: "/user/[id]", params: { id: item.id } });
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
              <Text style={[{ color: colors.mutedForeground, fontFamily: "DMSans_400Regular", fontSize: 14 }]}>
                None yet
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isOwnProfile = user?.id === id;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} onLikeToggle={handleLikeToggle} />}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.header,
                { paddingTop: topPad + 8, borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={colors.foreground} />
              </TouchableOpacity>

              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="person" size={36} color={colors.mutedForeground} />
                </View>
              )}

              <UserBadge
                username={profile?.username ?? ""}
                verified={profile?.verified ?? false}
                size="lg"
              />

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

              {!isOwnProfile && (
                <TouchableOpacity
                  onPress={handleFollowToggle}
                  disabled={followLoading}
                  style={[
                    styles.followBtn,
                    {
                      backgroundColor: isFollowing ? "transparent" : colors.primary,
                      borderColor: isFollowing ? colors.border : colors.primary,
                      borderWidth: 1,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color={isFollowing ? colors.foreground : colors.primaryForeground} />
                  ) : (
                    <Text
                      style={[
                        styles.followBtnText,
                        {
                          color: isFollowing ? colors.foreground : colors.primaryForeground,
                          fontFamily: "DMSans_600SemiBold",
                        },
                      ]}
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
            {posts.length === 0 && (
              <View style={styles.empty}>
                <Feather name="edit-3" size={32} color={colors.mutedForeground} />
                <Text style={[{ color: colors.mutedForeground, fontFamily: "DMSans_400Regular", fontSize: 14 }]}>
                  No posts yet
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { alignSelf: "flex-start" },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bio: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: "85%" },
  stats: { flexDirection: "row", alignItems: "center" },
  stat: { alignItems: "center", paddingHorizontal: 24, gap: 2 },
  statNum: { fontSize: 18 },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 30 },
  followBtn: {
    paddingHorizontal: 36,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 130,
    alignItems: "center",
  },
  followBtnText: { fontSize: 15 },
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
});
