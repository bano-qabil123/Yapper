import React, { useState } from "react";
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
  replies?: Comment[];
  onReply?: (comment: Comment) => void;
  isReply?: boolean;
};

export function CommentItem({ comment, replies = [], onReply, isReply = false }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [showReplies, setShowReplies] = useState(false);

  const handleProfilePress = () => {
    if (comment.profiles?.id === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push({ pathname: "/user/[id]", params: { id: comment.profiles?.id ?? "" } });
    }
  };

  return (
    <View style={isReply ? styles.replyContainer : undefined}>
      {isReply && (
        <View style={[styles.replyLine, { backgroundColor: colors.border }]} />
      )}
      <View style={[styles.row, { borderBottomColor: isReply ? "transparent" : colors.border }]}>
        <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.8}>
          {comment.profiles?.avatar_url ? (
            <Image source={{ uri: comment.profiles.avatar_url }} style={isReply ? styles.replyAvatar : styles.avatar} />
          ) : (
            <View
              style={[
                isReply ? styles.replyAvatarPlaceholder : styles.avatarPlaceholder,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Ionicons name="person" size={isReply ? 12 : 16} color={colors.mutedForeground} />
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

          {!isReply && (
            <View style={styles.footer}>
              {onReply && (
                <TouchableOpacity onPress={() => onReply(comment)} activeOpacity={0.7}>
                  <Text style={[styles.replyBtn, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
                    Reply
                  </Text>
                </TouchableOpacity>
              )}
              {replies.length > 0 && (
                <TouchableOpacity onPress={() => setShowReplies((v) => !v)} activeOpacity={0.7}>
                  <Text style={[styles.replyBtn, { color: colors.primary, fontFamily: "DMSans_500Medium" }]}>
                    {showReplies ? "Hide replies" : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {showReplies && replies.length > 0 && (
        <View style={[styles.repliesBlock, { borderBottomColor: colors.border }]}>
          {replies.map((r) => (
            <CommentItem key={r.id} comment={r} onReply={onReply} isReply />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  replyContainer: { position: "relative" },
  replyLine: {
    position: "absolute",
    left: 28,
    top: 0,
    bottom: 0,
    width: 1,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarPlaceholder: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  replyAvatar: { width: 26, height: 26, borderRadius: 13 },
  replyAvatarPlaceholder: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, gap: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontSize: 12 },
  footer: { flexDirection: "row", gap: 16, marginTop: 4 },
  replyBtn: { fontSize: 12 },
  repliesBlock: {
    marginLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
