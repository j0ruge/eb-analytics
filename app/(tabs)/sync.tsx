import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { lessonService } from "../../src/services/lessonService";
import { exportService } from "../../src/services/exportService";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { SkeletonLoader } from "../../src/components/SkeletonLoader";
import { ErrorRetry } from "../../src/components/ErrorRetry";

export default function SyncScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [completedCount, setCompletedCount] = useState(0);
  const [exportedCount, setExportedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setError(false);
      setLoading(true);
      const completed = await lessonService.getCompletedLessons();
      const exported = await lessonService.getExportedLessons();
      setCompletedCount(completed.length);
      setExportedCount(exported.length);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (completedCount === 0) {
      Alert.alert("Aviso", "Não há aulas finalizadas para exportar.");
      return;
    }

    setExporting(true);
    try {
      await exportService.exportData();
      Alert.alert(
        "Sucesso",
        `${completedCount} aula(s) exportada(s) com sucesso! O status foi atualizado para EXPORTED.`,
      );
      await loadStats();
    } catch (err: any) {
      Alert.alert("Erro na Exportação", err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader count={2} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorRetry onRetry={loadStats} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Status da Sincronização</Text>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Aulas Finalizadas:</Text>
          <Text style={styles.statValue}>{completedCount}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Aulas Exportadas:</Text>
          <Text style={[styles.statValue, styles.statValueWarning]}>
            {exportedCount}
          </Text>
        </View>
        <Text style={styles.info}>
          Aulas finalizadas estão prontas para serem exportadas. Aulas
          exportadas aguardam sincronização.
        </Text>
      </View>

      <AnimatedPressable
        style={[
          styles.exportButton,
          completedCount === 0 && styles.disabledButton,
        ]}
        onPress={handleExport}
        disabled={exporting || completedCount === 0}
      >
        {exporting ? (
          <ActivityIndicator color={theme.colors.background} />
        ) : (
          <Text style={styles.exportButtonText}>Exportar Dados (JSON)</Text>
        )}
      </AnimatedPressable>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
    },
    card: {
      backgroundColor: theme.colors.surfaceElevated,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      ...theme.shadows.md,
      marginBottom: theme.spacing.xl,
    },
    title: {
      ...theme.typography.h2,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
    },
    statLabel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    statValue: {
      ...theme.typography.h3,
      color: theme.colors.primary,
    },
    statValueWarning: {
      color: theme.colors.warning,
    },
    info: {
      marginTop: theme.spacing.md,
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    exportButton: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
    },
    disabledButton: {
      backgroundColor: theme.colors.border,
    },
    exportButtonText: {
      ...theme.typography.h3,
      color: theme.colors.background,
    },
  });
