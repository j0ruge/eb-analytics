import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../hooks/useTheme";
import { Theme } from "../theme";
import { LessonTopic } from "../types/lessonTopic";
import { topicService } from "../services/topicService";

interface TopicPickerProps {
  seriesId: string | null;
  selectedId: string | null;
  onSelect: (topic: LessonTopic | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TopicPicker({
  seriesId,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = "Selecione uma lição",
}: TopicPickerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [topics, setTopics] = useState<LessonTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<LessonTopic | null>(null);

  useEffect(() => {
    if (seriesId) {
      loadTopics(seriesId);
    } else {
      setTopics([]);
      setSelectedTopic(null);
    }
  }, [seriesId]);

  useEffect(() => {
    if (selectedId && topics.length > 0) {
      const found = topics.find((t) => t.id === selectedId);
      setSelectedTopic(found || null);
    } else if (!selectedId) {
      setSelectedTopic(null);
    }
  }, [selectedId, topics]);

  const loadTopics = async (sId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await topicService.getTopicsBySeries(sId);
      setTopics(data);
    } catch (err: any) {
      const message = err?.message || "Falha ao carregar lições";
      console.error("Error loading topics:", err);
      setError(message);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: LessonTopic) => {
    setSelectedTopic(item);
    onSelect(item);
    setModalVisible(false);
  };

  const handleClear = () => {
    setSelectedTopic(null);
    onSelect(null);
    setModalVisible(false);
  };

  const isDisabled = disabled || !seriesId;

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Lição</Text>
        <View style={[styles.picker, styles.pickerDisabled]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Lição</Text>
        <View style={[styles.picker, styles.pickerError]}>
          <Text style={styles.errorText} numberOfLines={1}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => seriesId && loadTopics(seriesId)}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Lição</Text>
      <TouchableOpacity
        style={[styles.picker, isDisabled && styles.pickerDisabled]}
        onPress={() => !isDisabled && setModalVisible(true)}
        disabled={isDisabled}
      >
        <Text style={[styles.pickerText, !selectedTopic && styles.placeholder]}>
          {selectedTopic
            ? `${selectedTopic.sequence_order}. ${selectedTopic.title}`
            : !seriesId
              ? "Selecione uma série primeiro"
              : placeholder}
        </Text>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione uma Lição</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {topics.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Nenhuma lição nesta série</Text>
                <Text style={styles.emptySubtext}>
                  Cadastre uma lição primeiro
                </Text>
              </View>
            ) : (
              <FlatList
                data={topics}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.listItem,
                      selectedTopic?.id === item.id && styles.listItemSelected,
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.itemRow}>
                      <Text style={styles.itemOrder}>
                        {item.sequence_order}
                      </Text>
                      <View style={styles.itemContent}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        {item.suggested_date && (
                          <Text style={styles.itemDate}>
                            Data sugerida: {item.suggested_date}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={renderSeparator}
              />
            )}

            {selectedTopic && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
              >
                <Text style={styles.clearButtonText}>Limpar Seleção</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
    },
    label: {
      ...theme.typography.label,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    picker: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm + 4,
    },
    pickerDisabled: {
      opacity: 0.6,
    },
    pickerText: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
    },
    placeholder: {
      color: theme.colors.textSecondary,
    },
    chevron: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      maxHeight: "70%",
      paddingBottom: theme.spacing.xl,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    closeButton: {
      fontSize: 20,
      color: theme.colors.textSecondary,
      padding: theme.spacing.xs,
    },
    listItem: {
      padding: theme.spacing.md,
    },
    listItemSelected: {
      backgroundColor: theme.colors.surface,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    itemOrder: {
      ...theme.typography.label,
      fontWeight: "700",
      color: theme.colors.primary,
      width: 30,
      marginRight: theme.spacing.sm,
    },
    itemContent: {
      flex: 1,
    },
    itemTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    itemDate: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
    },
    emptyState: {
      padding: theme.spacing.xl,
      alignItems: "center",
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    emptySubtext: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    clearButton: {
      margin: theme.spacing.md,
      padding: theme.spacing.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
    },
    clearButtonText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    pickerError: {
      borderColor: theme.colors.danger,
    },
    errorText: {
      ...theme.typography.caption,
      color: theme.colors.danger,
      flex: 1,
    },
    retryText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: "600",
      marginLeft: theme.spacing.sm,
    },
  });
