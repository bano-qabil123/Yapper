import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
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

type Props = {
  post: Post;
  onLikeToggle?: (postId: string, liked: boolean) => void;
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

export function PostCard({ post, onLikeToggle }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

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
      style={[styles.card, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
        {post.profiles?.avatar_url ? (
          <Image source={{ uri: post.profiles.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
            <Ionicons name="person" size={20} color={colors.mutedForeground} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <UserBadge
              username={post.profiles?.username ?? "unknown"}
              verified={post.profiles?.verified ?? false}
            />
          </TouchableOpacity>
          <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            {timeAgo(post.created_at)}
          </Text>
        </View>

        <RichText content={post.content} style={styles.body} />

        {post.media_url && (
          <Image
            source={{ uri: post.media_url }}
            style={[styles.media, { borderColor: colors.border }]}
            resizeMode="cover"
          />
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={handleLike} activeOpacity={0.7}>
            <Ionicons
              name={post.is_liked ? "heart" : "heart-outline"}
              size={20}
              color={post.is_liked ? "#ff453a" : colors.mutedForeground}
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
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: {
    fontSize: 13,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  media: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionCount: {
    fontSize: 13,
  },
});
