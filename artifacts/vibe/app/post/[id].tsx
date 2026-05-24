import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { supabase, Post, Comment } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { PostCard } from "@/components/PostCard";
import { CommentItem } from "@/components/CommentItem";

export default function PostDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !user) return;
    const [{ data: postData }, { data: commentData }] = await Promise.all([
      supabase.from("posts").select("*, profiles(*)").eq("id", id).single(),
      supabase
        .from("comments")
        .select("*, profiles(*)")
        .eq("post_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (postData) {
      const [{ data: likes }, { data: likesByUser }] = await Promise.all([
        supabase.from("likes").select("post_id").eq("post_id", id),
        supabase.from("likes").select("post_id").eq("post_id", id).eq("user_id", user.id),
      ]);
      setPost({
        ...postData,
        likes_count: likes?.length ?? 0,
        comments_count: commentData?.length ?? 0,
        is_liked: (likesByUser?.length ?? 0) > 0,
      } as Post);
    }
    setComments((commentData ?? []) as Comment[]);
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user || !id) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { error } = await supabase.from("comments").insert({
      post_id: id,
      user_id: user.id,
      content: commentText.trim(),
    });

    if (!error) {
      if (post?.user_id && post.user_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: user.id,
          type: "comment",
          post_id: id,
          read: false,
        });
      }
      setCommentText("");
      setPost((prev) => prev ? { ...prev, comments_count: (prev.comments_count ?? 0) + 1 } : prev);
      load();
    }
    setSubmitting(false);
  };

  const handleLikeToggle = useCallback((postId: string, liked: boolean) => {
    setPost((prev) =>
      prev
        ? { ...prev, is_liked: liked, likes_count: (prev.likes_count ?? 0) + (liked ? 1 : -1) }
        : prev
    );
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "DMSans_600SemiBold" }]}>
          Post
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CommentItem comment={item} />}
        ListHeaderComponent={
          post ? (
            <View>
              <PostCard post={post} onLikeToggle={handleLikeToggle} />
              <View style={[styles.commentsLabel, { borderBottomColor: colors.border }]}>
                <Text style={[styles.commentsText, { color: colors.mutedForeground, fontFamily: "DMSans_500Medium" }]}>
                  {comments.length} {comments.length === 1 ? "reply" : "replies"}
                </Text>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              No replies yet. Be first.
            </Text>
          </View>
        }
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: colors.secondary,
              color: colors.foreground,
              fontFamily: "DMSans_400Regular",
            },
          ]}
          placeholder="Reply..."
          placeholderTextColor={colors.mutedForeground}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={300}
        />
        <TouchableOpacity
          onPress={handleSubmitComment}
          disabled={submitting || !commentText.trim()}
          style={[
            styles.sendBtn,
            { backgroundColor: commentText.trim() ? colors.primary : colors.secondary },
          ]}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={18}
              color={commentText.trim() ? colors.primaryForeground : colors.mutedForeground}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17 },
  commentsLabel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentsText: { fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { fontSize: 14 },
});
