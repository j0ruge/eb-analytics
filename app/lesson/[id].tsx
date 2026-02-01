import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { lessonService } from "../../src/services/lessonService";
import { Lesson, LessonStatus } from "../../src/types/lesson";
import { theme } from "../../src/theme";
import { CounterStepper } from "../../src/components/CounterStepper";
import { TimeCaptureButton } from "../../src/components/TimeCaptureButton";
import { ProfessorPicker } from "../../src/components/ProfessorPicker";
import { SeriesPicker } from "../../src/components/SeriesPicker";
import { TopicPicker } from "../../src/components/TopicPicker";
import { useDebounce } from "../../src/hooks/useDebounce";
import { TouchableOpacity } from "react-native";
import { LessonSeries } from "../../src/types/lessonSeries";
import { LessonTopic } from "../../src/types/lessonTopic";
import { topicService } from "../../src/services/topicService";

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  const debouncedLesson = useDebounce(lesson, 500);

  useEffect(() => {
    if (id) {
      loadLesson();
    }
  }, [id]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debouncedLesson) {
      saveChanges(debouncedLesson);
    }
  }, [debouncedLesson]);

  async function loadLesson() {
    const data = await lessonService.getById(id);
    setLesson(data);

    // Se tiver lesson_topic_id, buscar a series_id correspondente
    if (data?.lesson_topic_id) {
      const topic = await topicService.getTopicById(data.lesson_topic_id);
      if (topic) {
        setSelectedSeriesId(topic.series_id);
      }
    }

    setLoading(false);
  }

  async function saveChanges(updatedLesson: Lesson) {
    try {
      await lessonService.updateLesson(updatedLesson.id, updatedLesson);
      console.log("Auto-saved successfully");
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  }

  function captureTime(field: "time_real_start" | "time_real_end") {
    const now = new Date();
    const time = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    updateField(field, time);
  }

  function clearTime(field: "time_real_start" | "time_real_end") {
    updateField(field, null);
  }

  function setManualTime(field: "time_real_start" | "time_real_end", time: string) {
    updateField(field, time);
  }

  function updateField<K extends keyof Lesson>(field: K, value: Lesson[K]) {
    if (!lesson) return;
    setLesson({ ...lesson, [field]: value });
  }

  async function handleSeriesSelect(series: LessonSeries | null) {
    setSelectedSeriesId(series?.id || null);

    // Quando troca a série, limpa o tópico selecionado
    if (lesson && lesson.lesson_topic_id) {
      const updates = {
        lesson_topic_id: null,
        series_name: series?.title || "",
        lesson_title: "",
      };

      setLesson({ ...lesson, ...updates });

      // Save immediately
      try {
        await lessonService.updateLesson(lesson.id, updates);
        console.log("Series updated successfully");
      } catch (error) {
        console.error("Failed to update series:", error);
      }
    }
  }

  async function handleProfessorSelect(professorId: string | null) {
    if (!lesson) return;

    const updates = { professor_id: professorId };

    // Update local state
    setLesson({ ...lesson, ...updates });

    // Save immediately
    try {
      await lessonService.updateLesson(lesson.id, updates);
      console.log("Professor updated successfully");
    } catch (error) {
      console.error("Failed to update professor:", error);
    }
  }

  async function handleTopicSelect(topic: LessonTopic | null) {
    if (!lesson) return;

    const updates = {
      lesson_topic_id: topic?.id || null,
      lesson_title: topic?.title || "",
    };

    // Update local state
    setLesson({ ...lesson, ...updates });

    // Save immediately (don't wait for debounce)
    try {
      await lessonService.updateLesson(lesson.id, updates);
      console.log("Topic updated successfully");
    } catch (error) {
      console.error("Failed to update topic:", error);
    }
  }

  async function handleComplete() {
    if (!lesson) return;
    Alert.alert("Finalizar Aula", "Deseja marcar esta aula como concluída?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Finalizar",
        onPress: async () => {
          await lessonService.updateLesson(lesson.id, {
            status: LessonStatus.COMPLETED,
          });
          router.replace("/");
        },
      },
    ]);
  }

  async function handleDelete() {
    if (!lesson) return;
    Alert.alert(
      "Excluir Aula",
      "Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: confirmDelete,
        },
      ]
    );
  }

  async function confirmDelete() {
    if (!lesson) return;
    setDeleting(true);
    try {
      await lessonService.deleteLesson(lesson.id);
      Alert.alert("Sucesso", "Aula excluída com sucesso", [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Erro ao excluir aula"
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={styles.errorContainer}>
        <Text>Aula não encontrada.</Text>
      </View>
    );
  }

  const isReadOnly = lesson.status !== LessonStatus.IN_PROGRESS;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>{lesson.date}</Text>
        <View
          style={[
            styles.statusBadge,
            isReadOnly && { backgroundColor: theme.colors.success },
          ]}
        >
          <Text style={styles.statusText}>{lesson.status}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Identificação</Text>
        <SeriesPicker
          selectedId={selectedSeriesId}
          onSelect={handleSeriesSelect}
          disabled={isReadOnly}
        />
        <TopicPicker
          seriesId={selectedSeriesId}
          selectedId={lesson.lesson_topic_id}
          onSelect={handleTopicSelect}
          disabled={isReadOnly}
        />
        <ProfessorPicker
          label="Professor"
          selectedProfessorId={lesson.professor_id}
          onSelect={handleProfessorSelect}
          disabled={isReadOnly}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Horários</Text>
        <View style={styles.row}>
          <TimeCaptureButton
            label="Início Real"
            value={lesson.time_real_start}
            onCapture={() => captureTime("time_real_start")}
            onClear={() => clearTime("time_real_start")}
            onManualSet={(time) => setManualTime("time_real_start", time)}
            disabled={isReadOnly}
          />
          <TimeCaptureButton
            label="Fim Real"
            value={lesson.time_real_end}
            onCapture={() => captureTime("time_real_end")}
            onClear={() => clearTime("time_real_end")}
            onManualSet={(time) => setManualTime("time_real_end", time)}
            disabled={isReadOnly}
          />
        </View>
        <Text style={styles.hint}>
          Previsto: {lesson.time_expected_start} às {lesson.time_expected_end}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Frequência (Attendance)</Text>
        <CounterStepper
          label="Início da Aula"
          value={lesson.attendance_start}
          onIncrement={() =>
            updateField("attendance_start", lesson.attendance_start + 1)
          }
          onDecrement={() =>
            updateField(
              "attendance_start",
              Math.max(0, lesson.attendance_start - 1),
            )
          }
          disabled={isReadOnly}
        />
        <CounterStepper
          label="Meio da Aula"
          value={lesson.attendance_mid}
          onIncrement={() =>
            updateField("attendance_mid", lesson.attendance_mid + 1)
          }
          onDecrement={() =>
            updateField(
              "attendance_mid",
              Math.max(0, lesson.attendance_mid - 1),
            )
          }
          disabled={isReadOnly}
        />
        <CounterStepper
          label="Fim da Aula"
          value={lesson.attendance_end}
          onIncrement={() =>
            updateField("attendance_end", lesson.attendance_end + 1)
          }
          onDecrement={() =>
            updateField(
              "attendance_end",
              Math.max(0, lesson.attendance_end - 1),
            )
          }
          disabled={isReadOnly}
        />
        <CounterStepper
          label="Participantes Únicos"
          value={lesson.unique_participants}
          onIncrement={() =>
            updateField("unique_participants", lesson.unique_participants + 1)
          }
          onDecrement={() =>
            updateField(
              "unique_participants",
              Math.max(0, lesson.unique_participants - 1),
            )
          }
          disabled={isReadOnly}
        />
      </View>

      {lesson.status === LessonStatus.IN_PROGRESS && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonText}>Finalizar Aula</Text>
        </TouchableOpacity>
      )}

      {lesson.status === LessonStatus.IN_PROGRESS && (
        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          <Text style={styles.deleteButtonText}>
            {deleting ? "Processando..." : "Excluir Aula"}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
  },
  dateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.text,
  },
  statusBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  disabledInput: {
    backgroundColor: "#E5E5EA",
    color: theme.colors.textSecondary,
  },
  row: {
    flexDirection: "row",
  },
  hint: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  completeButton: {
    backgroundColor: theme.colors.success,
    marginHorizontal: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  completeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: theme.colors.danger,
    marginHorizontal: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textSecondary,
    opacity: 0.6,
  },
});
