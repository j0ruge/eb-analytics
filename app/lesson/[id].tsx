import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { lessonService } from "../../src/services/lessonService";
import { Lesson, LessonStatus, STATUS_LABELS } from "../../src/types/lesson";
import { SyncStatus } from "../../src/types/sync";
import { syncService } from "../../src/services/syncService";
import { useAuth } from "../../src/hooks/useAuth";
import { useSyncQueue } from "../../src/hooks/useSyncQueue";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { CounterStepper } from "../../src/components/CounterStepper";
import { TimeCaptureButton } from "../../src/components/TimeCaptureButton";
import { ProfessorPicker } from "../../src/components/ProfessorPicker";
import { SeriesPicker } from "../../src/components/SeriesPicker";
import { TopicPicker } from "../../src/components/TopicPicker";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { DatePickerInput } from "../../src/components/DatePickerInput";
import { Ionicons } from "@expo/vector-icons";
import { useDebounce } from "../../src/hooks/useDebounce";
import { LessonSeries } from "../../src/types/lessonSeries";
import { LessonTopic } from "../../src/types/lessonTopic";
import { topicService } from "../../src/services/topicService";

const STATUS_ICONS: Record<LessonStatus, keyof typeof Ionicons.glyphMap> = {
  [LessonStatus.IN_PROGRESS]: "pencil-outline",
  [LessonStatus.COMPLETED]: "checkmark-circle-outline",
  [LessonStatus.EXPORTED]: "cloud-upload-outline",
  [LessonStatus.SYNCED]: "sync-outline",
};

const STATUS_COLORS: Record<LessonStatus, keyof Theme["colors"]> = {
  [LessonStatus.IN_PROGRESS]: "primary",
  [LessonStatus.COMPLETED]: "success",
  [LessonStatus.EXPORTED]: "warning",
  [LessonStatus.SYNCED]: "info",
};

function getStatusColor(status: LessonStatus, theme: Theme): string {
  return theme.colors[STATUS_COLORS[status]] ?? theme.colors.textSecondary;
}

export default function LessonDetailScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { retryNow } = useSyncQueue();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  const skipAutoSaveRef = useRef(false);

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
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }
    if (debouncedLesson) {
      saveChanges(debouncedLesson);
    }
  }, [debouncedLesson]);

  async function loadLesson() {
    try {
      setLoadError(false);
      setLoading(true);
      const data = await lessonService.getById(id);
      setLesson(data);

      if (data?.lesson_topic_id) {
        const topic = await topicService.getTopicById(data.lesson_topic_id);
        if (topic) {
          setSelectedSeriesId(topic.series_id);
        }
      }
    } catch (err) {
      console.error("Failed to load lesson:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function saveChanges(updatedLesson: Lesson) {
    try {
      await lessonService.updateLesson(updatedLesson.id, updatedLesson);
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

  function setManualTime(
    field: "time_real_start" | "time_real_end",
    time: string,
  ) {
    updateField(field, time);
  }

  function updateField<K extends keyof Lesson>(field: K, value: Lesson[K]) {
    if (!lesson) return;
    setLesson({ ...lesson, [field]: value });
  }

  async function handleSeriesSelect(series: LessonSeries | null) {
    setSelectedSeriesId(series?.id || null);

    if (lesson && lesson.lesson_topic_id) {
      const updates = {
        lesson_topic_id: null,
        series_name: series?.title || "",
        lesson_title: "",
      };

      skipAutoSaveRef.current = true;
      setLesson({ ...lesson, ...updates });

      try {
        await lessonService.updateLesson(lesson.id, updates);
      } catch (error) {
        console.error("Failed to update series:", error);
      }
    }
  }

  async function handleProfessorSelect(professorId: string | null) {
    if (!lesson) return;

    const updates = { professor_id: professorId };

    skipAutoSaveRef.current = true;
    setLesson({ ...lesson, ...updates });

    try {
      await lessonService.updateLesson(lesson.id, updates);
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

    skipAutoSaveRef.current = true;
    setLesson({ ...lesson, ...updates });

    try {
      await lessonService.updateLesson(lesson.id, updates);
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
          try {
            await lessonService.updateLesson(lesson.id, {
              status: LessonStatus.COMPLETED,
            });
            router.replace("/" as any);
          } catch (err) {
            console.error("Failed to complete lesson:", err);
            Alert.alert(
              "Erro",
              err instanceof Error ? err.message : "Falha ao finalizar aula",
            );
          }
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
      ],
    );
  }

  async function handleSendToCloud() {
    if (!lesson) return;
    setSending(true);
    try {
      await syncService.enqueue(lesson.id);
      // Kick the loop through the hook so provider state refreshes.
      await retryNow([lesson.id]);
      const updated = await lessonService.getById(lesson.id);
      if (updated) setLesson(updated);
      if (updated?.sync_status === SyncStatus.SYNCED) {
        Alert.alert("Sucesso", "Enviado para a nuvem");
      } else if (updated?.sync_status === SyncStatus.REJECTED) {
        Alert.alert(
          "Erro",
          updated.sync_error ?? "O servidor rejeitou esta aula",
        );
      } else {
        // Still QUEUED or SENDING — the sync loop will finish in background.
        // User sees the "Na fila para envio" / "Enviando..." banner on return.
        Alert.alert(
          "Na fila",
          "Enviando em segundo plano. Acompanhe o status na tela de sincronização.",
        );
      }
    } catch (err) {
      console.error("handleSendToCloud failed:", err);
      Alert.alert(
        "Erro",
        err instanceof Error ? err.message : "Falha ao enviar para a nuvem",
      );
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete() {
    if (!lesson) return;
    setDeleting(true);
    try {
      await lessonService.deleteLesson(lesson.id);
      Alert.alert("Sucesso", "Aula excluída com sucesso", [
        { text: "OK", onPress: () => router.replace("/" as any) },
      ]);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Erro ao excluir aula",
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

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Erro ao carregar a aula.</Text>
        <AnimatedPressable style={styles.retryButton} onPress={loadLesson}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </AnimatedPressable>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Aula não encontrada.</Text>
      </View>
    );
  }

  // Lock when the lesson is no longer IN_PROGRESS. Spec 008 FR-012 also
  // requires all inputs disabled once sync_status = SYNCED — implicitly
  // covered because SYNCED rows are always COMPLETED, but enforce
  // defensively so a future FR that relaxes the LessonStatus lock cannot
  // unintentionally unlock a synced row.
  const isReadOnly =
    lesson.status !== LessonStatus.IN_PROGRESS ||
    lesson.sync_status === SyncStatus.SYNCED;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <View style={styles.header}>
        <View style={styles.headerDatePicker}>
          <DatePickerInput
            value={lesson.date}
            onChange={(date) => updateField("date", date)}
            disabled={isReadOnly}
          />
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(lesson.status, theme) },
          ]}
        >
          <Ionicons
            name={STATUS_ICONS[lesson.status] || "ellipse-outline"}
            size={12}
            color={theme.colors.background}
            style={styles.statusIconSpacer}
            accessible={false}
          />
          <Text style={styles.statusText}>
            {STATUS_LABELS[lesson.status] ?? lesson.status}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="book-outline" size={18} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>Identificação</Text>
        </View>
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
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={18} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>Horários</Text>
        </View>
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
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={18} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>Frequência (Attendance)</Text>
        </View>
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

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Contei o professor nestas contagens</Text>
          <Switch
            value={!!lesson.includes_professor}
            onValueChange={(next) => updateField("includes_professor", next)}
            disabled={isReadOnly}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.surface}
            accessibilityRole="switch"
            accessibilityLabel="Contei o professor nestas contagens"
          />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text-outline" size={18} color={theme.colors.text} />
          <Text style={styles.sectionTitle}>Observações</Text>
        </View>
        <Text style={styles.inputLabel}>Clima</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Ex: Ensolarado 28°C"
          placeholderTextColor={theme.colors.textSecondary}
          value={lesson.weather ?? ""}
          onChangeText={(text) => updateField("weather", text.length > 0 ? text : null)}
          editable={!isReadOnly}
          accessibilityLabel="Clima"
        />
        <Text style={styles.inputLabel}>Observações</Text>
        <TextInput
          style={[styles.textInput, styles.textInputMultiline]}
          placeholder="Observações livres sobre a aula"
          placeholderTextColor={theme.colors.textSecondary}
          value={lesson.notes ?? ""}
          onChangeText={(text) => updateField("notes", text.length > 0 ? text : null)}
          editable={!isReadOnly}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          accessibilityLabel="Observações"
        />
      </View>

      {lesson.status === LessonStatus.IN_PROGRESS && (
        <AnimatedPressable
          style={styles.completeButton}
          onPress={handleComplete}
        >
          <Text style={styles.completeButtonText}>Finalizar Aula</Text>
        </AnimatedPressable>
      )}

      {lesson.status === LessonStatus.IN_PROGRESS && (
        <AnimatedPressable
          style={[styles.deleteButton, deleting && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          <Text style={styles.deleteButtonText}>
            {deleting ? "Processando..." : "Excluir Aula"}
          </Text>
        </AnimatedPressable>
      )}

      {/* Spec 008 FR-013 — REJECTED banner, no re-send affordance. */}
      {lesson.sync_status === SyncStatus.REJECTED && (
        <View style={styles.rejectedBanner}>
          <Ionicons
            name="alert-circle"
            size={24}
            color={theme.colors.background}
          />
          <View style={styles.rejectedBannerText}>
            <Text style={styles.rejectedBannerTitle}>
              Rejeitada pelo servidor
            </Text>
            <Text style={styles.rejectedBannerBody}>
              {lesson.sync_error ?? "Fale com o coordenador."}
            </Text>
          </View>
        </View>
      )}

      {/* Spec 008 FR-010 — "Enviar pra Nuvem" button only when
          logged in + COMPLETED + sync_status = LOCAL. */}
      {!authLoading &&
        isAuthenticated &&
        lesson.status === LessonStatus.COMPLETED &&
        lesson.sync_status === SyncStatus.LOCAL && (
          <AnimatedPressable
            style={[styles.cloudButton, sending && styles.buttonDisabled]}
            onPress={handleSendToCloud}
            disabled={sending}
            accessibilityLabel="Enviar aula para a nuvem"
          >
            {sending ? (
              <ActivityIndicator color={theme.colors.background} />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={20}
                  color={theme.colors.background}
                  style={styles.cloudButtonIcon}
                  accessible={false}
                />
                <Text style={styles.cloudButtonText}>Enviar pra Nuvem</Text>
              </>
            )}
          </AnimatedPressable>
        )}

      {/* QUEUED / SENDING indicator — read-only status cue. */}
      {(lesson.sync_status === SyncStatus.QUEUED ||
        lesson.sync_status === SyncStatus.SENDING) && (
        <View style={styles.syncingBanner}>
          <Ionicons
            name="cloud-outline"
            size={18}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.syncingBannerText}>
            {lesson.sync_status === SyncStatus.SENDING
              ? "Enviando..."
              : "Na fila para envio"}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
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
    errorText: {
      color: theme.colors.text,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    headerDatePicker: {},
    dateText: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs / 2,
      borderRadius: theme.borderRadius.sm,
    },
    statusIconSpacer: {
      marginRight: theme.spacing.xs,
    },
    statusText: {
      ...theme.typography.caption,
      color: theme.colors.background,
      fontWeight: "bold",
    },
    card: {
      backgroundColor: theme.colors.surfaceElevated,
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.sm,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    sectionTitle: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    row: {
      flexDirection: "row",
    },
    hint: {
      marginTop: theme.spacing.sm,
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontStyle: "italic",
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    toggleLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    inputLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    textInput: {
      ...theme.typography.body,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    textInputMultiline: {
      minHeight: 96,
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
      ...theme.typography.h3,
      color: theme.colors.background,
    },
    cloudButton: {
      flexDirection: "row",
      backgroundColor: theme.colors.primary,
      marginHorizontal: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      justifyContent: "center",
      marginTop: theme.spacing.md,
    },
    cloudButtonIcon: {
      marginRight: theme.spacing.sm,
    },
    cloudButtonText: {
      ...theme.typography.h3,
      color: theme.colors.background,
    },
    retryButton: {
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md,
    },
    retryButtonText: {
      ...theme.typography.body,
      color: theme.colors.background,
      fontWeight: "bold",
    },
    rejectedBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.danger,
      marginHorizontal: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    rejectedBannerText: {
      flex: 1,
    },
    rejectedBannerTitle: {
      ...theme.typography.body,
      color: theme.colors.background,
      fontWeight: "bold",
    },
    rejectedBannerBody: {
      ...theme.typography.bodySmall,
      color: theme.colors.background,
      marginTop: theme.spacing.xs / 2,
    },
    syncingBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.md,
      marginTop: theme.spacing.md,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
    },
    syncingBannerText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
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
      ...theme.typography.h3,
      color: theme.colors.background,
    },
    buttonDisabled: {
      backgroundColor: theme.colors.textSecondary,
      opacity: 0.6,
    },
  });
