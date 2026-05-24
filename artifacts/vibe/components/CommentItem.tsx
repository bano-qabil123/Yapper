import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { UserBadge } from "@/components/UserBadge";
import { RichText } from "@/components/RichText";
import { Comment } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

type Props = {
  comment: Comment;
};

export function CommentItem({ comment }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const handleProfilePress = () => {
    if (comment.profiles?.id === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push({ pathname: "/user/[id]", params: { id: comment.profiles?.id ?? "" } });
    }
  };

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
        {comment.profiles?.avatar_url ? (
          <Image source={{ uri: comment.profiles.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
            <Ionicons name="person" size={16} color={colors.mutedForeground} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
            <UserBadge
              username={comment.profiles?.username ?? "unknown"}
              verified={comment.profiles?.verified ?? false}
              size="sm"
            />
          </TouchableOpacity>
          <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            {timeAgo(comment.created_at)}
          </Text>
        </View>
        <RichText content={comment.content} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  time: {
    fontSize: 12,
  },
});
