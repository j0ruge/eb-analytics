import { View, Text, FlatList, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useState, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { lessonService } from "../../src/services/lessonService";
import {
  LessonWithDetails,
  LessonStatus,
  STATUS_LABELS,
} from "../../src/types/lesson";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { StatusFilterBar } from "../../src/components/StatusFilterBar";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { FAB } from "../../src/components/FAB";
import { EmptyState } from "../../src/components/EmptyState";
import { SkeletonLoader } from "../../src/components/SkeletonLoader";
import { ErrorRetry } from "../../src/components/ErrorRetry";

const STATUS_ICONS: Record<LessonStatus, keyof typeof Ionicons.glyphMap> = {
  [LessonStatus.IN_PROGRESS]: "pencil-outline",
  [LessonStatus.COMPLETED]: "checkmark-circle-outline",
  [LessonStatus.EXPORTED]: "cloud-upload-outline",
  [LessonStatus.SYNCED]: "sync-outline",
};

export default function HomeScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [lessons, setLessons] = useState<LessonWithDetails[]>([]);
  const [activeFilters, setActiveFilters] = useState<LessonStatus[]>([
    LessonStatus.IN_PROGRESS,
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  const loadData = React.useCallback(async () => {
    try {
      setError(false);
      setLoading(true);
      const lessonsData = await lessonService.getAllLessonsWithDetails();
      setLessons(lessonsData);
    } catch (err) {
      console.error("Error loading lessons:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const filteredLessons =
    activeFilters.length === 0
      ? []
      : lessons.filter((lesson) =>
          activeFilters.includes(lesson.status as LessonStatus),
        );

  function getStatusLabel(status: LessonStatus): string {
    return STATUS_LABELS[status] ?? status;
  }

  const STATUS_COLORS: Record<LessonStatus, keyof Theme["colors"]> = {
    [LessonStatus.IN_PROGRESS]: "primary",
    [LessonStatus.COMPLETED]: "success",
    [LessonStatus.EXPORTED]: "warning",
    [LessonStatus.SYNCED]: "info",
  };

  function getStatusColor(status: LessonStatus): string {
    return theme.colors[STATUS_COLORS[status]] ?? theme.colors.textSecondary;
  }

  const renderItem = ({ item }: { item: LessonWithDetails }) => (
    <AnimatedPressable
      onPress={() => router.push(`/lesson/${item.id}`)}
      style={styles.lessonItem}
    >
      <View style={styles.lessonContent}>
        <Text style={styles.lessonTitle}>
          {item.topic_title || item.lesson_title || "Aula sem título"}
        </Text>
        <Text style={styles.lessonSubtitle}>
          {item.series_code ? `${item.series_code} · ` : ""}
          {item.date} · {item.professor_name_resolved || "Sem professor"}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) },
        ]}
      >
        <Ionicons
          name={STATUS_ICONS[item.status] || "ellipse-outline"}
          size={12}
          color={theme.colors.background}
          style={styles.iconSpacer}
        />
        <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
      </View>
    </AnimatedPressable>
  );

  return (
    <View style={styles.container}>
      <StatusFilterBar
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
      />
      {loading ? (
        <SkeletonLoader count={5} />
      ) : error ? (
        <ErrorRetry onRetry={loadData} />
      ) : (
        <FlatList
          data={filteredLessons}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            activeFilters.length === 0 ? (
              <EmptyState
                icon="filter-outline"
                title="Selecione um filtro"
                description="Selecione um filtro para ver as aulas"
              />
            ) : (
              <EmptyState
                icon="book-outline"
                title="Nenhuma aula encontrada"
                description="Nenhuma aula com os filtros selecionados"
                actionLabel="Criar primeira aula"
                onAction={() => router.push("/lesson/new")}
              />
            )
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB onPress={() => router.push("/lesson/new")} label="Nova Aula" />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      padding: theme.spacing.md,
    },
    lessonItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
    },
    lessonTitle: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    lessonSubtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: theme.borderRadius.sm,
    },
    statusText: {
      ...theme.typography.caption,
      color: theme.colors.background,
      fontWeight: "bold",
    },
    lessonContent: {
      flex: 1,
    },
    iconSpacer: {
      marginRight: 4,
    },
  });
