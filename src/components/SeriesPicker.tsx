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
import { LessonSeries } from "../types/lessonSeries";
import { seriesService } from "../services/seriesService";

interface SeriesPickerProps {
  selectedId: string | null;
  onSelect: (series: LessonSeries | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SeriesPicker({
  selectedId,
  onSelect,
  disabled = false,
  placeholder = "Selecione uma série",
}: SeriesPickerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [series, setSeries] = useState<LessonSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<LessonSeries | null>(
    null,
  );

  useEffect(() => {
    loadSeries();
  }, []);

  useEffect(() => {
    if (selectedId && series.length > 0) {
      const found = series.find((s) => s.id === selectedId);
      setSelectedSeries(found || null);
    } else {
      setSelectedSeries(null);
    }
  }, [selectedId, series]);

  const loadSeries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await seriesService.getAllSeries();
      setSeries(data);
    } catch (err: any) {
      const message = err?.message || "Falha ao carregar séries";
      console.error("Error loading series:", err);
      setError(message);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: LessonSeries) => {
    setSelectedSeries(item);
    onSelect(item);
    setModalVisible(false);
  };

  const handleClear = () => {
    setSelectedSeries(null);
    onSelect(null);
    setModalVisible(false);
  };

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Série</Text>
        <View style={[styles.picker, styles.pickerDisabled]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Série</Text>
        <View style={[styles.picker, styles.pickerError]}>
          <Text style={styles.errorText} numberOfLines={1}>
            {error}
          </Text>
          <TouchableOpacity onPress={loadSeries}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Série</Text>
      <TouchableOpacity
        style={[styles.picker, disabled && styles.pickerDisabled]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <Text
          style={[styles.pickerText, !selectedSeries && styles.placeholder]}
        >
          {selectedSeries
            ? `${selectedSeries.code} - ${selectedSeries.title}`
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
              <Text style={styles.modalTitle}>Selecione uma Série</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {series.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Nenhuma série cadastrada</Text>
                <Text style={styles.emptySubtext}>
                  Cadastre uma série primeiro
                </Text>
              </View>
            ) : (
              <FlatList
                data={series}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.listItem,
                      selectedSeries?.id === item.id && styles.listItemSelected,
                    ]}
                    onPress={() => handleSelect(item)}
                  >
                    <Text style={styles.itemCode}>{item.code}</Text>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={renderSeparator}
              />
            )}

            {selectedSeries && (
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
    itemCode: {
      ...theme.typography.label,
      color: theme.colors.primary,
      marginBottom: 2,
    },
    itemTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
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
