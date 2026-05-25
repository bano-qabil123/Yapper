import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  ScrollView,
  Dimensions,
  Modal,
  Share,
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { UserBadge } from "@/components/UserBadge";
import { RichText } from "@/components/RichText";
import { Post, supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const SCREEN_WIDTH = Dimensions.get("window").width;

const REPORT_REASONS = [
  "Spam",
  "AI Generated Content",
  "Hate Speech",
  "Misinformation",
  "Other",
];

type Props = {
  post: Post;
  onLikeToggle?: (postId: string, liked: boolean) => void;
  onBookmarkToggle?: (postId: string, bookmarked: boolean) => void;
  onDelete?: (postId: string) => void;
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

function formatViews(v: number): string {
  if (v < 1000) return `${v}`;
  if (v < 1_000_000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

function parseMediaUrls(mediaUrl: string | null): string[] {
  if (!mediaUrl) return [];
  return mediaUrl.split(",").map((u) => u.trim()).filter(Boolean);
}

function MediaImage({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  const colors = useColors();
  if (failed) {
    return (
      <View style={[styles.singleMedia, { backgroundColor: colors.card2, alignItems: "center", justifyContent: "center" }]}>
        <Feather name="image" size={28} color={colors.mutedForeground} />
      </View>
    );
  }
  return (
    <Image source={{ uri }} style={styles.singleMedia} resizeMode="cover" onError={() => setFailed(true)} />
  );
}

export function PostCard({ post, onLikeToggle, onBookmarkToggle, onDelete }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const isOwn = post.user_id === user?.id;

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number>(0);

  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [hidden, setHidden] = useState(false);

  const mediaUrls = parseMediaUrls(post.media_url);

  if (hidden) return null;

  const triggerHeartAnim = () => {
    heartScale.setValue(0.3);
    heartOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1.2, useNativeDriver: true, friction: 4 }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(heartOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const handleDoubleTap = useCallback(async () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!user || post.is_liked) return;
      triggerHeartAnim();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      onLikeToggle?.(post.id, true);
    }
    lastTap.current = now;
  }, [user, post, onLikeToggle]);

  const handleLike = useCallback(async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (post.is_liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
    }
    onLikeToggle?.(post.id, !post.is_liked);
  }, [user, post, onLikeToggle]);

  const handleBookmark = useCallback(async () => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isBookmarked;
    setIsBookmarked(next);
    if (next) {
      await supabase.from("bookmarks").insert({ post_id: post.id, user_id: user.id });
    } else {
      await supabase.from("bookmarks").delete().eq("post_id", post.id).eq("user_id", user.id);
    }
    onBookmarkToggle?.(post.id, next);
  }, [user, post, isBookmarked, onBookmarkToggle]);

  const handlePress = () => router.push({ pathname: "/post/[id]", params: { id: post.id } });

  const handleProfilePress = () => {
    if (post.author?.id === user?.id) router.push("/(tabs)/profile");
    else router.push({ pathname: "/user/[id]", params: { id: post.author?.id ?? "" } });
  };

  const handleCopy = async () => {
    setMenuOpen(false);
    await Share.share({ message: post.content });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShare = async () => {
    setMenuOpen(false);
    await Share.share({ message: post.content, title: "Shared from Vibe" });
  };

  const handleDelete = () => {
    setMenuOpen(false);
    Alert.alert("Delete post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("posts").delete().eq("id", post.id);
          onDelete?.(post.id);
          setHidden(true);
        },
      },
    ]);
  };

  const handleReportReason = async (reason: string) => {
    if (!user) return;
    setReportOpen(false);
    await supabase.from("reports").insert({ post_id: post.id, reporter_id: user.id, reason });
    setReportSubmitted(true);
    setHidden(true);
    Alert.alert("Thanks for reporting", "We'll review this post.");
  };

  const MenuSheet = () => (
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <TouchableOpacity style={styles.menuScrim} activeOpacity={1} onPress={() => setMenuOpen(false)}>
        <View style={[styles.menuSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MenuItem icon="copy" label="Copy text" onPress={handleCopy} />
          <MenuItem icon="share" label="Share post" onPress={handleShare} />
          {isOwn && <MenuItem icon="trash-2" label="Delete post" onPress={handleDelete} destructive />}
          {!isOwn && (
            <MenuItem
              icon="flag"
              label="Report post"
              onPress={() => { setMenuOpen(false); setTimeout(() => setReportOpen(true), 300); }}
              destructive
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const MenuItem = ({
    icon,
    label,
    onPress,
    destructive,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Feather name={icon as any} size={16} color={destructive ? "#ef4444" : colors.foreground} />
      <Text style={[styles.menuLabel, { color: destructive ? "#ef4444" : colors.foreground, fontFamily: "DMSans_500Medium" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const ReportSheet = () => (
    <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
      <TouchableOpacity style={styles.menuScrim} activeOpacity={1} onPress={() => setReportOpen(false)}>
        <View style={[styles.reportSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.reportTitle, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
            Report post
          </Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[styles.reportOption, { borderBottomColor: colors.border }]}
              onPress={() => handleReportReason(reason)}
              activeOpacity={0.7}
            >
              <Text style={[styles.reportLabel, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}>
                {reason}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <TouchableOpacity onPress={handleDoubleTap} activeOpacity={1} style={[styles.card, { borderBottomColor: colors.border }]}>
      {/* Header row */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8} style={styles.profileRow}>
          {post.author?.avatar_url ? (
            <Image source={{ uri: post.author.avatar_url }} style={styles.avatar} onError={() => {}} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person" size={16} color={colors.mutedForeground} />
            </View>
          )}
          <UserBadge username={post.author?.username ?? "unknown"} verified={post.author?.verified ?? false} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            {timeAgo(post.created_at)}
          </Text>
          <TouchableOpacity onPress={() => setMenuOpen(true)} activeOpacity={0.7} style={styles.moreBtn}>
            <Feather name="more-horizontal" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {post.content.length > 0 && (
        <RichText content={post.content} style={[styles.body, { color: colors.foreground }]} />
      )}

      {/* Media */}
      {mediaUrls.length === 1 && (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.95}>
          <MediaImage uri={mediaUrls[0]} />
        </TouchableOpacity>
      )}
      {mediaUrls.length > 1 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.carousel}>
          {mediaUrls.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={styles.carouselImage} resizeMode="cover" onError={() => {}} />
          ))}
        </ScrollView>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike} activeOpacity={0.7}>
          <Ionicons
            name={post.is_liked ? "heart" : "heart-outline"}
            size={20}
            color={post.is_liked ? colors.accentGreen : colors.mutedForeground}
          />
          {(post.likes_count ?? 0) > 0 && (
            <Text style={[styles.actionCount, { color: post.is_liked ? colors.accentGreen : colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
              {post.likes_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handlePress} activeOpacity={0.7}>
          <Feather name="message-circle" size={19} color={colors.primary} />
          {(post.comments_count ?? 0) > 0 && (
            <Text style={[styles.actionCount, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
              {post.comments_count}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.actionSpacer} />

        <TouchableOpacity style={styles.action} onPress={handleBookmark} activeOpacity={0.7}>
          <Feather
            name={isBookmarked ? "bookmark" : "bookmark"}
            size={19}
            color={isBookmarked ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      {/* Views counter — only for own posts */}
      {isOwn && (post.views ?? 0) > 0 && (
        <Text style={[styles.views, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
          👁 {formatViews(post.views ?? 0)} views
        </Text>
      )}

      {/* Double-tap heart overlay */}
      <Animated.View pointerEvents="none" style={[styles.heartOverlay, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}>
        <Ionicons name="heart" size={80} color={colors.accentGreen} />
      </Animated.View>

      <MenuSheet />
      <ReportSheet />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  time: { fontSize: 12 },
  moreBtn: { padding: 3 },
  body: { fontSize: 15, lineHeight: 22 },
  singleMedia: { width: "100%", height: 300, marginTop: 2 },
  carousel: { width: SCREEN_WIDTH - 32, height: 260, marginTop: 2 },
  carouselImage: { width: SCREEN_WIDTH - 32, height: 260 },
  actions: { flexDirection: "row", gap: 22, marginTop: 2, alignItems: "center" },
  action: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionSpacer: { flex: 1 },
  actionCount: { fontSize: 13 },
  views: { fontSize: 12, marginTop: -4 },
  heartOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  menuScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  menuLabel: { fontSize: 16 },
  reportSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  reportTitle: { fontSize: 17, paddingHorizontal: 20, paddingVertical: 18 },
  reportOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  reportLabel: { fontSize: 15 },
});
