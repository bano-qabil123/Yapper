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
  Platform,
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

type Props = {
  post: Post;
  onLikeToggle?: (postId: string, liked: boolean) => void;
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function parseMediaUrls(mediaUrl: string | null): string[] {
  if (!mediaUrl) return [];
  return mediaUrl.split(",").map((u) => u.trim()).filter(Boolean);
}

export function PostCard({ post, onLikeToggle }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<number>(0);

  const mediaUrls = parseMediaUrls(post.media_url);

  const triggerHeartAnim = () => {
    heartScale.setValue(0.3);
    heartOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(heartScale, {
        toValue: 1.2,
        useNativeDriver: true,
        friction: 4,
      }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
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
      await supabase
        .from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
    }
    onLikeToggle?.(post.id, !post.is_liked);
  }, [user, post, onLikeToggle]);

  const handlePress = () => {
    router.push({ pathname: "/post/[id]", params: { id: post.id } });
  };

  const handleProfilePress = () => {
    if (post.profiles?.id === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push({ pathname: "/user/[id]", params: { id: post.profiles?.id ?? "" } });
    }
  };

  return (
    <TouchableOpacity
      onPress={handleDoubleTap}
      activeOpacity={1}
      style={[styles.card, { borderBottomColor: colors.border }]}
    >
      <View style={styles.topRow}>
        <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8} style={styles.profileRow}>
          {post.profiles?.avatar_url ? (
            <Image source={{ uri: post.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
              <Ionicons name="person" size={16} color={colors.mutedForeground} />
            </View>
          )}
          <UserBadge
            username={post.profiles?.username ?? "unknown"}
            verified={post.profiles?.verified ?? false}
          />
        </TouchableOpacity>
        <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
          {timeAgo(post.created_at)}
        </Text>
      </View>

      <RichText content={post.content} style={[styles.body, { color: colors.foreground }]} />

      {mediaUrls.length === 1 && (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.95}>
          <Image
            source={{ uri: mediaUrls[0] }}
            style={styles.singleMedia}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {mediaUrls.length > 1 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.carousel}
        >
          {mediaUrls.map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              style={[styles.carouselImage]}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike} activeOpacity={0.7}>
          <Ionicons
            name={post.is_liked ? "heart" : "heart-outline"}
            size={20}
            color={post.is_liked ? colors.primary : colors.mutedForeground}
          />
          {(post.likes_count ?? 0) > 0 && (
            <Text style={[styles.actionCount, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
              {post.likes_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handlePress} activeOpacity={0.7}>
          <Feather name="message-circle" size={19} color={colors.mutedForeground} />
          {(post.comments_count ?? 0) > 0 && (
            <Text style={[styles.actionCount, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
              {post.comments_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} activeOpacity={0.7}>
          <Feather name="share" size={19} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.heartOverlay,
          { opacity: heartOpacity, transform: [{ scale: heartScale }] },
        ]}
      >
        <Ionicons name="heart" size={80} color="#fff" />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  time: { fontSize: 12 },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  singleMedia: {
    width: "100%",
    height: 300,
    marginTop: 2,
  },
  carousel: {
    width: SCREEN_WIDTH - 32,
    height: 260,
    marginTop: 2,
  },
  carouselImage: {
    width: SCREEN_WIDTH - 32,
    height: 260,
  },
  actions: {
    flexDirection: "row",
    gap: 22,
    marginTop: 2,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionCount: { fontSize: 13 },
  heartOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
