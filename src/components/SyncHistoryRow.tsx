import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Theme } from '../theme';
import type { LessonWithDetails } from '../types/lesson';

interface SyncHistoryRowProps {
  lesson: LessonWithDetails;
}

// Spec 008 FR-016 — read-only "Enviado" row in the 7-day history list on /sync.
// No action affordance — rows are locked per FR-012.
export function SyncHistoryRow({ lesson }: SyncHistoryRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const title =
    lesson.topic_title || lesson.lesson_title || lesson.series_name || 'Aula';
  const professor =
    lesson.professor_name_resolved || lesson.professor_name || '';

  return (
    <View style={styles.container}>
      <Ionicons
        name="checkmark-circle"
        size={20}
        color={theme.colors.success}
        accessible={false}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle}>
          {lesson.date}
          {professor ? ` — ${professor}` : ''}
        </Text>
      </View>
      <Text style={styles.status}>Enviado</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    body: {
      flex: 1,
    },
    title: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    subtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs / 2,
    },
    status: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
  });
