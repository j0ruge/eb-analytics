import { useState, useMemo } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import React from "react";
import { seriesService } from "../../src/services/seriesService";
import { topicService } from "../../src/services/topicService";
import { LessonSeries } from "../../src/types/lessonSeries";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { FAB } from "../../src/components/FAB";
import { EmptyState } from "../../src/components/EmptyState";
import { SkeletonLoader } from "../../src/components/SkeletonLoader";
import { ErrorRetry } from "../../src/components/ErrorRetry";

interface SeriesWithCount extends LessonSeries {
  topicCount: number;
}

export default function SeriesListScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const [series, setSeries] = useState<SeriesWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function loadSeries() {
    try {
      setError(false);
      setLoading(true);
      const data = await seriesService.getAllSeries();

      const seriesIds = data.map((s) => s.id);
      const topicCounts = await topicService.getTopicCountsBySeries(seriesIds);

      const seriesWithCounts = data.map((s) => ({
        ...s,
        topicCount: topicCounts[s.id] ?? 0,
      }));

      setSeries(seriesWithCounts);
    } catch (err) {
      console.error("Error loading series:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    React.useCallback(() => {
      loadSeries();
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader count={4} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorRetry onRetry={loadSeries} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={series}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AnimatedPressable
            onPress={() => router.push(`/series/${item.id}` as any)}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.code}>{item.code}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.topicCount} {item.topicCount === 1 ? "tópico" : "tópicos"}</Text>
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            {item.description && (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </AnimatedPressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="library-outline"
            title="Nenhuma série cadastrada"
            description="Crie uma série para organizar as lições"
            actionLabel="Criar primeira série"
            onAction={() => router.push("/series/new")}
          />
        }
        contentContainerStyle={
          series.length === 0 ? styles.emptyContainer : undefined
        }
      />

      <FAB onPress={() => router.push("/series/new")} label="Nova Série" />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    card: {
      backgroundColor: theme.colors.background,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.sm,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.xs,
    },
    code: {
      ...theme.typography.label,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    badge: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: 10,
    },
    badgeText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    title: {
      ...theme.typography.body,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    description: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
    },
  });
