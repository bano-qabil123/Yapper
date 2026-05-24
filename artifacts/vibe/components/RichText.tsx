import React from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

type Props = {
  content: string;
  style?: object;
  numberOfLines?: number;
};

export function RichText({ content, style, numberOfLines }: Props) {
  const colors = useColors();
  const router = useRouter();

  const words = content.split(/(\s+)/);

  const parts = words.map((word, index) => {
    if (word.startsWith("#") && word.length > 1) {
      const tag = word.replace(/[^#\w]/g, "");
      return (
        <Text
          key={index}
          style={[styles.link, { color: colors.primary }]}
          onPress={() => router.push({ pathname: "/(tabs)/search", params: { q: tag } })}
        >
          {word}
        </Text>
      );
    }
    if (word.startsWith("@") && word.length > 1) {
      const handle = word.replace(/[^@\w]/g, "").slice(1);
      return (
        <Text
          key={index}
          style={[styles.link, { color: colors.primary }]}
          onPress={() => router.push({ pathname: "/user/[id]", params: { id: handle } })}
        >
          {word}
        </Text>
      );
    }
    return <Text key={index}>{word}</Text>;
  });

  return (
    <Text
      style={[styles.text, { color: colors.foreground, fontFamily: "DMSans_400Regular" }, style]}
      numberOfLines={numberOfLines}
    >
      {parts}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    fontFamily: "DMSans_500Medium",
  },
});
