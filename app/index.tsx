import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useState } from "react";
import { lessonService } from "../src/services/lessonService";
import { LessonWithDetails, LessonStatus } from "../src/types/lesson";
import { theme } from "../src/theme";
import { StatusFilterBar } from "../src/components/StatusFilterBar";

export default function HomeScreen() {
  const [lessons, setLessons] = useState<LessonWithDetails[]>([]);
  const [activeFilters, setActiveFilters] = useState<LessonStatus[]>([
    LessonStatus.IN_PROGRESS,
  ]);
  const router = useRouter();

  // Recarrega lista quando a tela volta ao foco
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    const lessonsData = await lessonService.getAllLessonsWithDetails();
    setLessons(lessonsData);
  }

  const filteredLessons = activeFilters.length === 0
    ? []
    : lessons.filter(lesson =>
        activeFilters.includes(lesson.status as LessonStatus)
      );

  function getStatusLabel(status: string): string {
    switch (status) {
      case "IN_PROGRESS":
        return "Em Andamento";
      case "COMPLETED":
        return "Completa";
      case "EXPORTED":
        return "Exportada";
      case "SYNCED":
        return "Sincronizada";
      default:
        return status;
    }
  }

  const renderItem = ({ item }: { item: LessonWithDetails }) => (
    <TouchableOpacity
      style={styles.lessonItem}
      onPress={() => router.push(`/lesson/${item.id}`)}
    >
      <View style={{ flex: 1 }}>
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
        <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusFilterBar
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
      />
      <FlatList
        data={filteredLessons}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {activeFilters.length === 0
                ? "Selecione um filtro para ver as aulas"
                : "Nenhuma aula encontrada com os filtros selecionados"}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/lesson/new")}
      >
        <Text style={styles.fabText}>+ Nova Aula</Text>
      </TouchableOpacity>
    </View>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "IN_PROGRESS":
      return theme.colors.primary;
    case "COMPLETED":
      return theme.colors.success;
    case "EXPORTED":
      return theme.colors.warning;
    case "SYNCED":
      return theme.colors.info;
    default:
      return theme.colors.textSecondary;
  }
}

const styles = StyleSheet.create({
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
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  lessonSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    color: theme.colors.textSecondary,
  },
  fab: {
    position: "absolute",
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 30,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
