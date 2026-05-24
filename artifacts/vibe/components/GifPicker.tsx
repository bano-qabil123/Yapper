import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const TENOR_API_KEY = "LIVDSRZULELA";
const SCREEN_WIDTH = Dimensions.get("window").width;
const GIF_SIZE = (SCREEN_WIDTH - 4) / 2;

type GifResult = {
  id: string;
  url: string;
  preview: string;
};

type Props = {
  visible: boolean;
  onSelect: (gif: GifResult) => void;
  onClose: () => void;
};

export function GifPicker({ visible, onSelect, onClose }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=24&media_filter=gif,tinygif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=24&media_filter=gif,tinygif`;
      const res = await fetch(endpoint);
      const json = await res.json();
      const results: GifResult[] = (json.results ?? []).map((r: any) => ({
        id: r.id,
        url: r.media_formats?.gif?.url ?? r.media_formats?.tinygif?.url ?? "",
        preview: r.media_formats?.tinygif?.url ?? r.media_formats?.gif?.url ?? "",
      }));
      setGifs(results);
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (visible) search("");
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "DMSans_700Bold" }]}>
            GIFs
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.secondary }]}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "DMSans_400Regular" }]}
            placeholder="Search GIFs..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => search(query)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); search(""); }} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={gifs}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.85}
                style={styles.gifItem}
              >
                <Image
                  source={{ uri: item.preview }}
                  style={[styles.gif, { backgroundColor: colors.secondary }]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
                  No GIFs found
                </Text>
              </View>
            }
          />
        )}

        <Text style={[styles.poweredBy, { color: colors.mutedForeground, fontFamily: "DMSans_400Regular" }]}>
          Powered by Tenor
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  list: { paddingHorizontal: 2, paddingBottom: 16 },
  row: { gap: 2, marginBottom: 2 },
  gifItem: { width: GIF_SIZE, height: GIF_SIZE },
  gif: { width: "100%", height: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15 },
  poweredBy: { textAlign: "center", fontSize: 11, paddingBottom: 12 },
});
