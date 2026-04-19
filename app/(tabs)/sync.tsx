import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { lessonService } from "../../src/services/lessonService";
import { exportService } from "../../src/services/exportService";
import { syncService } from "../../src/services/syncService";
import { useTheme } from "../../src/hooks/useTheme";
import { useAuth } from "../../src/hooks/useAuth";
import { useSyncQueue } from "../../src/hooks/useSyncQueue";
import { Theme } from "../../src/theme";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";
import { SkeletonLoader } from "../../src/components/SkeletonLoader";
import { ErrorRetry } from "../../src/components/ErrorRetry";
import { PendingSubmissionRow } from "../../src/components/PendingSubmissionRow";
import { SyncHistoryRow } from "../../src/components/SyncHistoryRow";
import type { LessonWithDetails } from "../../src/types/lesson";

export default function SyncScreen() {
  const { theme } = useTheme();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { retryNow, sending: queueSending } = useSyncQueue();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [completedCount, setCompletedCount] = useState(0);
  const [exportedCount, setExportedCount] = useState(0);
  const [pending, setPending] = useState<LessonWithDetails[]>([]);
  const [history, setHistory] = useState<LessonWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      setError(false);
      setLoading(true);
      const completed = await lessonService.getCompletedLessons();
      const exported = await lessonService.getExportedLessons();
      setCompletedCount(completed.length);
      setExportedCount(exported.length);

      if (user?.id) {
        const lists = await syncService.listForSyncScreen(user.id);
        setPending(lists.pending);
        setHistory(lists.history);
      } else {
        setPending([]);
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to load sync screen data:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Re-load on focus and whenever the sync loop wraps up a batch.
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  // Refresh only on the true → false transition of `queueSending` so mount
  // (where it starts `false`) does not race the useFocusEffect load.
  const prevSendingRef = useRef(queueSending);
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = queueSending;
    if (wasSending && !queueSending) {
      loadAll().catch((err) =>
        console.error("queue-finished refresh failed:", err),
      );
    }
  }, [queueSending, loadAll]);

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
        `${completedCount} aula(s) exportada(s) com sucesso!`,
      );
      await loadAll();
    } catch (err: unknown) {
      Alert.alert(
        "Erro na Exportação",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setExporting(false);
    }
  }

  const handleRetry = useCallback(
    (id: string) => {
      retryNow([id]).catch((err) => {
        console.error("retryNow failed:", err);
        Alert.alert(
          "Erro",
          err instanceof Error ? err.message : "Falha ao tentar novamente",
        );
      });
    },
    [retryNow],
  );

  if (loading || authLoading) {
    return (
      <View style={styles.container}>
        <SkeletonLoader count={2} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorRetry onRetry={loadAll} />
      </View>
    );
  }

  const showHistory = pending.length === 0 && history.length > 0;
  const showEmpty = pending.length === 0 && history.length === 0;

  return (
    <FlatList
      style={styles.container}
      data={pending}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PendingSubmissionRow lesson={item} onRetry={handleRetry} />
      )}
      ListHeaderComponent={
        <View>
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
              <Text style={styles.exportButtonText}>
                Exportar Dados (JSON)
              </Text>
            )}
          </AnimatedPressable>

          {!authLoading && !isAuthenticated && (
            <View
              style={styles.syncNotice}
              accessible={true}
              accessibilityLabel="Faça login para sincronizar com a nuvem"
            >
              <Ionicons
                name="cloud-offline-outline"
                size={20}
                color={theme.colors.textSecondary}
                accessible={false}
              />
              <Text style={styles.syncNoticeText}>
                Faça login para sincronizar com a nuvem
              </Text>
            </View>
          )}

          {isAuthenticated && showHistory && (
            <View style={styles.allDoneBanner}>
              <Ionicons
                name="checkmark-done-circle"
                size={22}
                color={theme.colors.background}
                accessible={false}
              />
              <Text style={styles.allDoneBannerText}>Tudo em dia</Text>
            </View>
          )}

          {isAuthenticated && pending.length > 0 && (
            <Text style={styles.sectionHeader}>
              Pendentes ({pending.length})
            </Text>
          )}
        </View>
      }
      ListFooterComponent={
        <View>
          {isAuthenticated && showHistory && (
            <View style={styles.historySection}>
              <Text style={styles.sectionHeader}>
                Enviadas nos últimos 7 dias
              </Text>
              {history.map((item) => (
                <SyncHistoryRow key={item.id} lesson={item} />
              ))}
            </View>
          )}

          {isAuthenticated && showEmpty && (
            <View style={styles.emptyState}>
              <Ionicons
                name="cloud-done-outline"
                size={48}
                color={theme.colors.textSecondary}
                accessible={false}
              />
              <Text style={styles.emptyStateText}>
                Nenhuma submissão pendente.
              </Text>
            </View>
          )}
        </View>
      }
    />
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
      marginBottom: theme.spacing.lg,
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
      marginBottom: theme.spacing.lg,
    },
    disabledButton: {
      backgroundColor: theme.colors.border,
    },
    exportButtonText: {
      ...theme.typography.h3,
      color: theme.colors.background,
    },
    syncNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    syncNoticeText: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    allDoneBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.success,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    allDoneBannerText: {
      ...theme.typography.body,
      color: theme.colors.background,
      fontWeight: "bold",
    },
    sectionHeader: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    historySection: {
      marginTop: theme.spacing.md,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    emptyStateText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
  });
