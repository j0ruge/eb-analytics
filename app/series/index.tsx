import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import React from "react";
import { seriesService } from "../../src/services/seriesService";
import { topicService } from "../../src/services/topicService";
import { LessonSeries } from "../../src/types/lessonSeries";
import { theme } from "../../src/theme";

interface SeriesWithCount extends LessonSeries {
  topicCount: number;
}

export default function SeriesListScreen() {
  const router = useRouter();
  const [series, setSeries] = useState<SeriesWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadSeries() {
    try {
      setLoading(true);
      const data = await seriesService.getAllSeries();

      // Buscar contagem de tópicos para cada série
      const seriesWithCounts = await Promise.all(
        data.map(async (s) => ({
          ...s,
          topicCount: await topicService.getTopicCount(s.id),
        })),
      );

      setSeries(seriesWithCounts);
    } catch (error) {
      console.error("Error loading series:", error);
    } finally {
      setLoading(false);
    }
  }

  // Recarrega quando a tela recebe foco
  useFocusEffect(
    React.useCallback(() => {
      loadSeries();
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={series}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/series/${item.id}` as any)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.code}>{item.code}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.topicCount} tópicos</Text>
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            {item.description && (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma série cadastrada</Text>
            <Text style={styles.emptySubtext}>
              Toque no botão abaixo para criar uma nova série
            </Text>
          </View>
        }
        contentContainerStyle={
          series.length === 0 ? styles.emptyContainer : undefined
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/series/new")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: theme.colors.background,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  code: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  badge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "300",
  },
});
