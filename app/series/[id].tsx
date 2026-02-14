import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { seriesService } from "../../src/services/seriesService";
import { topicService } from "../../src/services/topicService";
import { LessonSeries } from "../../src/types/lessonSeries";
import { LessonTopic } from "../../src/types/lessonTopic";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { FAB } from "../../src/components/FAB";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorRetry } from "../../src/components/ErrorRetry";

export default function SeriesDetailScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [series, setSeries] = useState<LessonSeries | null>(null);
  const [topics, setTopics] = useState<LessonTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedCode, setEditedCode] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [id]),
  );

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
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
    } catch (err) {
      console.error("Error loading series:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
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

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <ErrorRetry onRetry={loadData} />
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: theme.colors.text }}>Série não encontrada.</Text>
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
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="characters"
                maxLength={20}
              />
              <TextInput
                style={styles.input}
                value={editedTitle}
                onChangeText={setEditedTitle}
                placeholder="Título"
                placeholderTextColor={theme.colors.textSecondary}
              />
              <TextInput
                style={[styles.input, styles.multiline]}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Descrição (opcional)"
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                numberOfLines={3}
              />
              <View style={styles.editButtons}>
                <AnimatedPressable
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={() => {
                    setEditing(false);
                    setEditedCode(series.code);
                    setEditedTitle(series.title);
                    setEditedDescription(series.description || "");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[styles.editButton, styles.saveButton]}
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.saveButtonText}>Salvar</Text>
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.title}>{series.title}</Text>
              {series.description && (
                <Text style={styles.description}>{series.description}</Text>
              )}
              <View style={styles.actionButtons}>
                <AnimatedPressable
                  style={styles.textButton}
                  onPress={() => setEditing(true)}
                >
                  <Text style={styles.textButtonLabel}>Editar</Text>
                </AnimatedPressable>
                <AnimatedPressable
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
                </AnimatedPressable>
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
            <EmptyState
              icon="list-outline"
              title="Nenhum tópico nesta série"
              description="Adicione tópicos para organizar as lições"
              actionLabel="Adicionar tópico"
              onAction={() => router.push(`/topics/new?seriesId=${id}`)}
            />
          ) : (
            topics.map((topic) => (
              <AnimatedPressable
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
              </AnimatedPressable>
            ))
          )}
        </View>
      </ScrollView>

      <FAB onPress={() => router.push(`/topics/new?seriesId=${id}`)} />
    </View>
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
    header: {
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
      margin: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
    },
    code: {
      ...theme.typography.label,
      fontWeight: "700",
      color: theme.colors.primary,
      marginBottom: theme.spacing.xs,
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    description: {
      ...theme.typography.bodySmall,
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
      ...theme.typography.label,
      color: theme.colors.primary,
    },
    editForm: {
      marginTop: theme.spacing.sm,
    },
    input: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      ...theme.typography.body,
      color: theme.colors.text,
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
      color: theme.colors.background,
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
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    topicCard: {
      flexDirection: "row",
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
    },
    topicOrder: {
      ...theme.typography.body,
      fontWeight: "700",
      color: theme.colors.primary,
      width: 30,
    },
    topicContent: {
      flex: 1,
    },
    topicTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    topicDate: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });
