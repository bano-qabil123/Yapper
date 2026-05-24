import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

type Props = {
  username: string;
  verified?: boolean;
  size?: "sm" | "md" | "lg";
  color?: string;
};

export function UserBadge({ username, verified = false, size = "md", color }: Props) {
  const colors = useColors();
  const fontSize = size === "sm" ? 13 : size === "lg" ? 18 : 15;
  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.username,
          { fontSize, color: color ?? colors.foreground, fontFamily: "DMSans_600SemiBold" },
        ]}
        numberOfLines={1}
      >
        {username}
      </Text>
      {verified && (
        <Ionicons
          name="checkmark-circle"
          size={iconSize}
          color={colors.primary}
          style={styles.badge}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  username: {
    flexShrink: 1,
  },
  badge: {
    marginTop: 1,
  },
});
