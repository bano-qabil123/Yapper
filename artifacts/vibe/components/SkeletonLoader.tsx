import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: 6, backgroundColor: colors.muted, opacity },
        style,
      ]}
    />
  );
}

export function PostSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.card, { borderBottomColor: colors.border }]}>
      <SkeletonBlock width={42} height={42} style={{ borderRadius: 21 }} />
      <View style={styles.content}>
        <SkeletonBlock width={120} height={14} />
        <SkeletonBlock width="90%" height={14} />
        <SkeletonBlock width="70%" height={14} />
      </View>
    </View>
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
  content: {
    flex: 1,
    gap: 8,
    paddingTop: 2,
  },
});
