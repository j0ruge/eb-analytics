import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { lessonService } from '../../src/services/lessonService';
import { exportService } from '../../src/services/exportService';
import { theme } from '../../src/theme';

export default function SyncScreen() {
  const [completedCount, setCompletedCount] = useState(0);
  const [exportedCount, setExportedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const completed = await lessonService.getCompletedLessons();
      const exported = await lessonService.getExportedLessons();
      setCompletedCount(completed.length);
      setExportedCount(exported.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (completedCount === 0) {
      Alert.alert('Aviso', 'Não há aulas finalizadas para exportar.');
      return;
    }

    setExporting(true);
    try {
      await exportService.exportData();
      Alert.alert(
        'Sucesso',
        `${completedCount} aula(s) exportada(s) com sucesso! O status foi atualizado para EXPORTED.`
      );
      // Recarregar estatísticas após exportação
      await loadStats();
    } catch (err: any) {
      Alert.alert('Erro na Exportação', err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
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
          <Text style={[styles.statValue, { color: theme.colors.warning }]}>{exportedCount}</Text>
        </View>
        <Text style={styles.info}>
          Aulas finalizadas estão prontas para serem exportadas. Aulas exportadas aguardam sincronização.
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.exportButton, completedCount === 0 && styles.disabledButton]} 
        onPress={handleExport}
        disabled={exporting || completedCount === 0}
      >
        {exporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.exportButtonText}>Exportar Dados (JSON)</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    elevation: 2,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  statLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  info: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  exportButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: theme.colors.border,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
