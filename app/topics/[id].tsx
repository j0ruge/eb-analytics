import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { topicService } from "../../src/services/topicService";
import { LessonTopicWithSeries } from "../../src/types/lessonTopic";
import { theme } from "../../src/theme";

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [topic, setTopic] = useState<LessonTopicWithSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDate, setEditedDate] = useState("");
  const [editedOrder, setEditedOrder] = useState("");

  useEffect(() => {
    loadTopic();
  }, [id]);

  async function loadTopic() {
    try {
      setLoading(true);
      const data = await topicService.getTopicWithSeries(id);
      setTopic(data);
      if (data) {
        setEditedTitle(data.title);
        setEditedDate(data.suggested_date || "");
        setEditedOrder(data.sequence_order.toString());
      }
    } catch (error) {
      console.error("Error loading topic:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!topic) return;

    if (!editedTitle.trim()) {
      Alert.alert("Erro", "O título é obrigatório.");
      return;
    }

    const order = parseInt(editedOrder, 10);
    if (isNaN(order) || order < 1) {
      Alert.alert("Erro", "A ordem deve ser um número maior que zero.");
      return;
    }

    try {
      await topicService.updateTopic(topic.id, {
        title: editedTitle.trim(),
        suggested_date: editedDate.trim() || null,
        sequence_order: order,
      });
      setTopic({
        ...topic,
        title: editedTitle.trim(),
        suggested_date: editedDate.trim() || null,
        sequence_order: order,
      });
      setEditing(false);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível salvar.");
    }
  }

  async function handleDelete() {
    Alert.alert(
      "Excluir Lição",
      `Deseja excluir a lição "${topic?.title}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await topicService.deleteTopic(id);
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

  if (!topic) {
    return (
      <View style={styles.errorContainer}>
        <Text>Lição não encontrada.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Info da série */}
      <View style={styles.seriesInfo}>
        <Text style={styles.seriesLabel}>Série:</Text>
        <Text style={styles.seriesName}>
          {topic.series_code} - {topic.series_title}
        </Text>
      </View>

      {/* Detalhes da lição */}
      <View style={styles.card}>
        {editing ? (
          <View style={styles.editForm}>
            <View style={styles.field}>
              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                value={editedTitle}
                onChangeText={setEditedTitle}
                placeholder="Título da lição"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Ordem Sequencial *</Text>
              <TextInput
                style={styles.input}
                value={editedOrder}
                onChangeText={setEditedOrder}
                placeholder="1, 2, 3..."
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Data Sugerida</Text>
              <TextInput
                style={styles.input}
                value={editedDate}
                onChangeText={setEditedDate}
                placeholder="AAAA-MM-DD"
              />
            </View>

            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.editButton, styles.cancelButton]}
                onPress={() => {
                  setEditing(false);
                  setEditedTitle(topic.title);
                  setEditedDate(topic.suggested_date || "");
                  setEditedOrder(topic.sequence_order.toString());
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
            <View style={styles.orderBadge}>
              <Text style={styles.orderText}>{topic.sequence_order}</Text>
            </View>
            <Text style={styles.title}>{topic.title}</Text>
            {topic.suggested_date && (
              <Text style={styles.date}>
                Data sugerida: {topic.suggested_date}
              </Text>
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
  seriesInfo: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    marginBottom: 0,
    borderRadius: theme.borderRadius.md,
  },
  seriesLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  seriesName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  orderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  orderText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  date: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
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
  field: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
});
