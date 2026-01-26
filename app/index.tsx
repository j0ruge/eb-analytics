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
import { professorService } from "../src/services/professorService";
import { Lesson } from "../src/types/lesson";
import { Professor } from "../src/types/professor";
import { theme } from "../src/theme";

export default function HomeScreen() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const router = useRouter();

  // Recarrega lista quando a tela volta ao foco
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    const [lessonsData, professorsData] = await Promise.all([
      lessonService.getAllLessons(),
      professorService.getAllProfessors(),
    ]);
    setLessons(lessonsData);
    setProfessors(professorsData);
  }

  function getProfessorName(professorId: string | null): string {
    if (!professorId) return "Sem professor";
    const professor = professors.find((p) => p.id === professorId);
    return professor?.name || "Sem professor";
  }

  const renderItem = ({ item }: { item: Lesson }) => (
    <TouchableOpacity
      style={styles.lessonItem}
      onPress={() => router.push(`/lesson/${item.id}`)}
    >
      <View>
        <Text style={styles.lessonTitle}>
          {item.lesson_title || "Aula sem título"}
        </Text>
        <Text style={styles.lessonSubtitle}>
          {item.date} - {getProfessorName(item.professor_id)}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) },
        ]}
      >
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={lessons}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nenhuma aula registrada.</Text>
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
