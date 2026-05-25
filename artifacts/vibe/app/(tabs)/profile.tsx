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
  Dimensions,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { supabase, Post, Profile } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { UserBadge } from "@/components/UserBadge";

type ProfileTab = "posts" | "media" | "likes" | "saved";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 2) / 3;

async function fetchUserPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*, author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, bio, verified)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Profile] posts error:", error.message); return []; }

  const pids = (data ?? []).map((p: Post) => p.id);
  if (pids.length === 0) return [];

  const [{ data: likes }, { data: likesByUser }, { data: comments }] = await Promise.all([
    supabase.from("likes").select("post_id").in("post_id", pids),
    supabase.from("likes").select("post_id").in("post_id", pids).eq("user_id", userId),
    supabase.from("comments").select("post_id").in("post_id", pids),
  ]);
  const likeCounts: Record<string, number> = {};
  (likes ?? []).forEach((l: { post_id: string }) => { likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1; });
  const likedSet = new Set((likesByUser ?? []).map((l: { post_id: string }) => l.post_id));
  const commentCounts: Record<string, number> = {};
  (comments ?? []).forEach((c: { post_id: string }) => { commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1; });

  return (data ?? []).map((p: Post) => ({
    ...p,
    likes_count: likeCounts[p.id] ?? 0,
    comments_count: commentCounts[p.id] ?? 0,
    is_liked: likedSet.has(p.id),
  }));
}

async function fetchLikedPosts(userId: string): Promise<Post[]> {
  const { data: likedData, error: likedError } = await supabase
    .from("likes").select("post_id").eq("user_id", userId);
  if (likedError) return [];
  const postIds = (likedData ?? []).map((l: { post_id: string }) => l.post_id);
  if (postIds.length === 0) return [];
  const { data } = await supabase
    .from("posts")
    .select("*, author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, bio, verified)")
    .in("id", postIds).order("created_at", { ascending: false });
  return (data ?? []) as Post[];
}

async function fetchBookmarkedPosts(userId: string): Promise<Post[]> {
  const { data: bkData, error: bkError } = await supabase
    .from("bookmarks").select("post_id").eq("user_id", userId);
  if (bkError) { console.error("[Profile] bookmarks error:", bkError.message); return []; }
  const postIds = (bkData ?? []).map((b: { post_id: string }) => b.post_id);
  if (postIds.length === 0) return [];
  const { data } = await supabase
    .from("posts")
    .select("*, author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url, bio, verified)")
    .in("id", postIds).order("created_at", { ascending: false });
  return (data ?? []) as Post[];
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<Profile[]>([]);
  const [followingList, setFollowingList] = useState<Profile[]>([]);
  // Verification request modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyReason, setVerifyReason] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    const [userPosts, liked, saved, { count: fwrCount }, { count: fwingCount }] = await Promise.all([
      fetchUserPosts(user.id),
      fetchLikedPosts(user.id),
      fetchBookmarkedPosts(user.id),
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("target_user_id", user.id),
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setPosts(userPosts);
    setMediaPosts(userPosts.filter((p) => p.media_url));
    setLikedPosts(liked);
    setSavedPosts(saved);
    setFollowerCount(fwrCount ?? 0);
    setFollowingCount(fwingCount ?? 0);
    setLoading(false);
    setRefreshing(false);

    // Check if verification request is pending
    const { data: vr } = await supabase
      .from("verification_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1);
    setVerifyPending((vr ?? []).length > 0);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const loadFollowers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("followers").select("profiles!followers_user_id_fkey(*)").eq("target_user_id", user.id);
    setFollowersList((data ?? []).map((d: { profiles: Profile }) => d.profiles));
    setShowFollowers(true);
  };

  const loadFollowing = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("followers").select("profiles!followers_target_user_id_fkey(*)").eq("user_id", user.id);
    setFollowingList((data ?? []).map((d: { profiles: Profile }) => d.profiles));
    setShowFollowing(true);
  };

  const handleVerifySubmit = async () => {
    if (!user || !verifyReason.trim()) return;
    setVerifySubmitting(true);
    const { error } = await supabase.from("verification_requests").insert({
      user_id: user.id,
      reason: verifyReason.trim(),
      status: "pending",
    });
    setVerifySubmitting(false);
    setShowVerifyModal(false);
    setVerifyReason("");
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setVerifyPending(true);
      Alert.alert("Submitted!", "Request submitted! We'll review it soon.");
    }
  };

  const TABS: { key: ProfileTab; icon: string }[] = [
    { key: "posts", icon: "grid" },
    { key: "media", icon: "image" },
    { key: "likes", icon: "heart" },
    { key: "saved", icon: "bookmark" },
  ];

  const activeData =
    activeTab === "posts" ? posts :
    activeTab === "media" ? mediaPosts :
    activeTab === "likes" ? likedPosts : savedPosts;

  const GridItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={[styles.gridItem, { width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE, backgroundColor: colors.card2 }]}
      onPress={() => router.push({ pathname: "/post/[id]", params: { id: item.id } })}
      activeOpacity={0.85}
    >
      {item.media_url ? (
        <Image source={{ uri: item.media_url.split(",")[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.textGridItem]}>
          <Text style={[styles.gridText, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]} numberOfLines={4}>
            {item.content}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const ProfileHeader = () => (
    <View>
      <View style={[styles.headerBg, { paddingTop: topPad + 12, backgroundColor: colors.card }]}>
        {/* Top-right buttons */}
        <View style={styles.topRightBtns}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/settings")} activeOpacity={0.7}>
            <Feather name="settings" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person" size={36} color={colors.mutedForeground} />
            </View>
          )}
          {profile?.verified && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </View>

        <Text style={[styles.username, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
          @{profile?.username ?? ""}
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>{posts.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>Posts</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.stat} onPress={loadFollowers} activeOpacity={0.8}>
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>{followerCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>Followers</Text>
          </TouchableOpacity>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.stat} onPress={loadFollowing} activeOpacity={0.8}>
            <Text style={[styles.statNum, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>{followingCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>Following</Text>
          </TouchableOpacity>
        </View>

        {(profile?.display_name || profile?.bio) && (
          <View style={styles.bioSection}>
            {profile?.display_name && (
              <Text style={[styles.displayName, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
                {profile.display_name}
              </Text>
            )}
            {profile?.bio && (
              <Text style={[styles.bio, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                {profile.bio}
              </Text>
            )}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            onPress={() => router.push("/edit-profile")}
            activeOpacity={0.8}
          >
            <Text style={[styles.editBtnText, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>
          {!profile?.verified && (
            <TouchableOpacity
              style={[styles.verifyBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={() => verifyPending ? null : setShowVerifyModal(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.verifyBtnText, { color: verifyPending ? colors.mutedForeground : colors.primary, fontFamily: "DMSans_500Medium" }]}>
                {verifyPending ? "Pending ✓" : "Get Verified"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {TABS.map(({ key, icon }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(key)}
            activeOpacity={0.8}
          >
            <Feather name={icon as any} size={18} color={activeTab === key ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const ProfileListModal = ({ visible, title, data, onClose }: { visible: boolean; title: string; data: Profile[]; onClose: () => void }) => (
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
              onPress={() => { onClose(); if (item.id !== user?.id) router.push({ pathname: "/user/[id]", params: { id: item.id } }); }}
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
              <Text style={{ color: colors.mutedForeground, fontFamily: "DMSans_400Regular", fontSize: 14 }}>None yet</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View>
          <ProfileHeader />
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          </View>
        </View>
      ) : (
        <FlatList
          key={activeTab}
          data={activeData}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => <GridItem item={item} />}
          ListHeaderComponent={<ProfileHeader />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather
                name={activeTab === "likes" ? "heart" : activeTab === "media" ? "image" : activeTab === "saved" ? "bookmark" : "edit-3"}
                size={36}
                color={colors.border}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
                {activeTab === "likes" ? "No liked posts" : activeTab === "media" ? "No media" : activeTab === "saved" ? "No saved posts" : "No posts yet"}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <ProfileListModal visible={showFollowers} title="Followers" data={followersList} onClose={() => setShowFollowers(false)} />
      <ProfileListModal visible={showFollowing} title="Following" data={followingList} onClose={() => setShowFollowing(false)} />

      {/* Verification Request Modal */}
      <Modal visible={showVerifyModal} transparent animationType="slide">
        <View style={styles.verifyScrim}>
          <View style={[styles.verifySheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.verifyHeader}>
              <Text style={[styles.verifyTitle, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
                Request Verification
              </Text>
              <TouchableOpacity onPress={() => setShowVerifyModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.verifyDesc, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              Tell us why you should be verified (e.g., public figure, creator, professional).
            </Text>
            <TextInput
              style={[styles.verifyInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, fontFamily: "DMSans_400Regular" }]}
              placeholder="Your reason..."
              placeholderTextColor={colors.mutedForeground}
              value={verifyReason}
              onChangeText={setVerifyReason}
              multiline
              maxLength={200}
            />
            <Text style={[styles.verifyCharCount, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              {verifyReason.length}/200
            </Text>
            <TouchableOpacity
              onPress={handleVerifySubmit}
              disabled={verifySubmitting || !verifyReason.trim()}
              style={[styles.verifySubmitBtn, { backgroundColor: verifyReason.trim() ? colors.primary : colors.secondary }]}
              activeOpacity={0.85}
            >
              {verifySubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.verifySubmitText, { fontFamily: "DMSans_600SemiBold" }]}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center" },
  headerBg: { paddingHorizontal: 20, paddingBottom: 20, alignItems: "center", gap: 12, position: "relative" },
  topRightBtns: { position: "absolute", top: 16, right: 20, zIndex: 1, flexDirection: "row", gap: 8 },
  iconBtn: { padding: 4 },
  avatarWrap: { position: "relative" },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  verifiedBadge: { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  username: { fontSize: 18 },
  stats: { flexDirection: "row", alignItems: "center" },
  stat: { alignItems: "center", paddingHorizontal: 20, gap: 2 },
  statNum: { fontSize: 20 },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 28 },
  bioSection: { alignItems: "center", gap: 4 },
  displayName: { fontSize: 16 },
  bio: { fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: "90%" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center", width: "100%" },
  editBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  editBtnText: { fontSize: 14 },
  verifyBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  verifyBtnText: { fontSize: 13 },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 13, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  gridItem: { overflow: "hidden", margin: StyleSheet.hairlineWidth },
  textGridItem: { padding: 8, justifyContent: "center" },
  gridText: { fontSize: 11, lineHeight: 15 },
  row: { gap: 0 },
  empty: { padding: 40, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 15 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, paddingTop: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 18 },
  userRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  miniAvatar: { width: 40, height: 40, borderRadius: 20 },
  miniAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  verifyScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  verifySheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14, borderWidth: StyleSheet.hairlineWidth },
  verifyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  verifyTitle: { fontSize: 18 },
  verifyDesc: { fontSize: 14, lineHeight: 20 },
  verifyInput: { borderRadius: 12, borderWidth: 1, padding: 14, minHeight: 100, fontSize: 15, textAlignVertical: "top" },
  verifyCharCount: { fontSize: 12, textAlign: "right" },
  verifySubmitBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  verifySubmitText: { fontSize: 16, color: "#fff" },
});
