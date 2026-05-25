import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { supabase, Profile } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { UserBadge } from "@/components/UserBadge";

const INTERESTS = [
  { emoji: "🎮", label: "Gaming" },
  { emoji: "🎨", label: "Art" },
  { emoji: "💻", label: "Dev" },
  { emoji: "🎵", label: "Music" },
  { emoji: "📸", label: "Photography" },
  { emoji: "🎬", label: "Film" },
  { emoji: "✍️", label: "Writing" },
  { emoji: "😂", label: "Memes" },
];

type SuggestedUser = Profile & { isFollowing: boolean };

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<SuggestedUser[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const toggleInterest = (label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const loadSuggested = async () => {
    if (!user) return;
    setLoadingSuggested(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", user.id)
      .limit(5);
    setSuggested(((data ?? []) as Profile[]).map((p) => ({ ...p, isFollowing: false })));
    setLoadingSuggested(false);
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      if (selectedInterests.length === 0) return;
      // Save interests
      if (user) {
        await supabase
          .from("profiles")
          .update({ interests: selectedInterests })
          .eq("id", user.id);
      }
      setStep(2);
      loadSuggested();
    } else {
      finish();
    }
  };

  const handleFollow = async (profile: SuggestedUser) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const alreadyFollowing = followingSet.has(profile.id);
    if (alreadyFollowing) {
      await supabase.from("followers").delete().eq("user_id", user.id).eq("target_user_id", profile.id);
      setFollowingSet((prev) => { const s = new Set(prev); s.delete(profile.id); return s; });
    } else {
      await supabase.from("followers").insert({ user_id: user.id, target_user_id: profile.id });
      setFollowingSet((prev) => new Set([...prev, profile.id]));
    }
  };

  const finish = async () => {
    if (!user) return;
    setFinishing(true);
    await supabase
      .from("profiles")
      .update({ onboarded: true })
      .eq("id", user.id);
    await refreshProfile();
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Progress dots */}
      <View style={[styles.progressRow, { paddingTop: topPad + 16 }]}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i <= step ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      {step === 0 && (
        <ScrollView contentContainerStyle={[styles.stepContent, { paddingBottom: insets.bottom + 120 }]}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoEmoji}>⚡</Text>
          </View>
          <Text style={[styles.welcomeTitle, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
            Welcome to Vibe
          </Text>
          <Text style={[styles.welcomeSub, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            No AI slop. No rage bait.{"\n"}Just real people sharing real things.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {[
              { emoji: "✨", text: "Authentic posts from real humans" },
              { emoji: "🔒", text: "No algorithmic manipulation" },
              { emoji: "❤️", text: "Community-first social network" },
            ].map(({ emoji, text }) => (
              <View key={text} style={styles.featureRow}>
                <Text style={styles.featureEmoji}>{emoji}</Text>
                <Text style={[styles.featureText, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}>
                  {text}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {step === 1 && (
        <ScrollView contentContainerStyle={[styles.stepContent, { paddingBottom: insets.bottom + 120 }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
            What are you into?
          </Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            Pick at least one to personalize your feed
          </Text>
          <View style={styles.chipsGrid}>
            {INTERESTS.map(({ emoji, label }) => {
              const selected = selectedInterests.includes(label);
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => toggleInterest(label)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipEmoji}>{emoji}</Text>
                  <Text
                    style={[
                      styles.chipLabel,
                      {
                        color: selected ? "#fff" : colors.foreground,
                        fontFamily: selected ? "DMSans_600SemiBold" : "DMSans_400Regular",
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView contentContainerStyle={[styles.stepContent, { paddingBottom: insets.bottom + 120 }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
            Who to follow
          </Text>
          <Text style={[styles.stepSub, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
            Follow a few people to get started
          </Text>
          {loadingSuggested ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <View style={[styles.suggestedList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {suggested.map((person, i) => {
                const isF = followingSet.has(person.id);
                return (
                  <View
                    key={person.id}
                    style={[
                      styles.personRow,
                      i < suggested.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                  >
                    {person.avatar_url ? (
                      <Image source={{ uri: person.avatar_url }} style={styles.personAvatar} />
                    ) : (
                      <View style={[styles.personAvatarPlaceholder, { backgroundColor: colors.secondary }]}>
                        <Ionicons name="person" size={18} color={colors.mutedForeground} />
                      </View>
                    )}
                    <View style={styles.personInfo}>
                      <UserBadge username={person.username} verified={person.verified} />
                      {person.bio && (
                        <Text style={[styles.personBio, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]} numberOfLines={1}>
                          {person.bio}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleFollow(person)}
                      style={[
                        styles.followBtn,
                        isF
                          ? { backgroundColor: "transparent", borderColor: colors.border, borderWidth: 1 }
                          : { backgroundColor: colors.primary },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.followBtnText, { color: isF ? colors.mutedForeground : "#fff", fontFamily: "DMSans_600SemiBold" }]}>
                        {isF ? "Following" : "Follow"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bottom action */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleNext}
          disabled={(step === 1 && selectedInterests.length === 0) || finishing}
          style={[
            styles.nextBtn,
            {
              backgroundColor:
                (step === 1 && selectedInterests.length === 0) || finishing
                  ? colors.secondary
                  : colors.primary,
            },
          ]}
          activeOpacity={0.85}
        >
          {finishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.nextBtnText, { fontFamily: "DMSans_600SemiBold" }]}>
              {step === 2 ? "Enter Vibe ⚡" : "Next"}
            </Text>
          )}
        </TouchableOpacity>
        {step === 2 && (
          <TouchableOpacity onPress={finish} activeOpacity={0.7}>
            <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
              Skip for now
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressRow: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  dot: { width: 32, height: 4, borderRadius: 2 },
  stepContent: { padding: 24, gap: 20, alignItems: "center" },
  logoCircle: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginTop: 20 },
  logoEmoji: { fontSize: 44 },
  welcomeTitle: { fontSize: 32, textAlign: "center", letterSpacing: -0.5 },
  welcomeSub: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  card: { width: "100%", borderRadius: 16, padding: 20, gap: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureEmoji: { fontSize: 20, width: 28 },
  featureText: { fontSize: 15, flex: 1 },
  stepTitle: { fontSize: 28, textAlign: "center", letterSpacing: -0.5, marginTop: 16 },
  stepSub: { fontSize: 15, textAlign: "center" },
  chipsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 99, borderWidth: 1 },
  chipEmoji: { fontSize: 18 },
  chipLabel: { fontSize: 15 },
  suggestedList: { width: "100%", borderRadius: 16, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  personRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  personAvatar: { width: 44, height: 44, borderRadius: 22 },
  personAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  personInfo: { flex: 1, gap: 2 },
  personBio: { fontSize: 12 },
  followBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 99 },
  followBtnText: { fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingTop: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  nextBtn: { width: "100%", height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  nextBtnText: { fontSize: 17, color: "#fff" },
  skipText: { fontSize: 14 },
});
