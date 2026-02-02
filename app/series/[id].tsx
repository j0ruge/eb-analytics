import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { seriesService } from "../../src/services/seriesService";
import { topicService } from "../../src/services/topicService";
import { LessonSeries } from "../../src/types/lessonSeries";
import { LessonTopic } from "../../src/types/lessonTopic";
import { theme } from "../../src/theme";

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [series, setSeries] = useState<LessonSeries | null>(null);
  const [topics, setTopics] = useState<LessonTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedCode, setEditedCode] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [seriesData, topicsData] = await Promise.all([
        seriesService.getSeriesById(id),
        topicService.getTopicsBySeries(id),
      ]);
      setSeries(seriesData);
      setTopics(topicsData);
      if (seriesData) {
        setEditedCode(seriesData.code);
        setEditedTitle(seriesData.title);
        setEditedDescription(seriesData.description || "");
      }
    } catch (error) {
      console.error("Error loading series:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!series) return;

    if (!editedCode.trim()) {
      Alert.alert("Erro", "O código é obrigatório.");
      return;
    }

    if (!editedTitle.trim()) {
      Alert.alert("Erro", "O título é obrigatório.");
      return;
    }

    try {
      await seriesService.updateSeries(series.id, {
        code: editedCode.trim(),
        title: editedTitle.trim(),
        description: editedDescription.trim() || null,
      });
      setSeries({
        ...series,
        code: editedCode.trim(),
        title: editedTitle.trim(),
        description: editedDescription.trim() || null,
      });
      setEditing(false);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível salvar.");
    }
  }

  async function handleDelete() {
    Alert.alert(
      "Excluir Série",
      `Deseja excluir a série "${series?.title}"? Esta ação também excluirá todos os tópicos associados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await seriesService.deleteSeries(id);
              router.back();
            } catch (error: any) {
              Alert.alert("Erro", error.message || "Não foi possível excluir.");
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.errorContainer}>
        <Text>Série não encontrada.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header da série */}
        <View style={styles.header}>
          <Text style={styles.code}>{series.code}</Text>

          {editing ? (
            <View style={styles.editForm}>
              <TextInput
                style={styles.input}
                value={editedCode}
                onChangeText={setEditedCode}
                placeholder="Código (ex: EB354)"
                autoCapitalize="characters"
                maxLength={20}
              />
              <TextInput
                style={styles.input}
                value={editedTitle}
                onChangeText={setEditedTitle}
                placeholder="Título"
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Descrição (opcional)"
                multiline
                numberOfLines={3}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={() => {
                    setEditing(false);
                    setEditedCode(series.code);
                    setEditedTitle(series.title);
                    setEditedDescription(series.description || "");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.title}>{series.title}</Text>
              {series.description && (
                <Text style={styles.description}>{series.description}</Text>
              )}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={() => setEditing(true)}
                >
                  <Text style={styles.textButtonLabel}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.textButton}
                  onPress={handleDelete}
                >
                  <Text
                    style={[
                      styles.textButtonLabel,
                      { color: theme.colors.danger },
                    ]}
                  >
                    Excluir
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Lista de lições */}
        <View style={styles.topicsSection}>
          <View style={styles.topicsHeader}>
            <Text style={styles.sectionTitle}>Lições ({topics.length})</Text>
          </View>

          {topics.length === 0 ? (
            <View style={styles.emptyTopics}>
              <Text style={styles.emptyText}>Nenhuma lição cadastrada</Text>
            </View>
          ) : (
            topics.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={styles.topicCard}
                onPress={() => router.push(`/topics/${topic.id}` as any)}
              >
                <Text style={styles.topicOrder}>{topic.sequence_order}</Text>
                <View style={styles.topicContent}>
                  <Text style={styles.topicTitle}>{topic.title}</Text>
                  {topic.suggested_date && (
                    <Text style={styles.topicDate}>
                      Data sugerida: {topic.suggested_date}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB para adicionar tópico */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/topics/new?seriesId=${id}`)}
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  code: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: theme.spacing.sm,
  },
  textButton: {
    marginRight: theme.spacing.md,
  },
  textButtonLabel: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "500",
  },
  editForm: {
    marginTop: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing.sm,
  },
  editButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  topicsSection: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  topicsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
  },
  emptyTopics: {
    padding: theme.spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  topicCard: {
    flexDirection: "row",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  topicOrder: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.primary,
    width: 30,
  },
  topicContent: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 16,
    color: theme.colors.text,
  },
  topicDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
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
