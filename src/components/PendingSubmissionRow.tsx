import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Theme } from '../theme';
import { AnimatedPressable } from './AnimatedPressable';
import { SyncStatus } from '../types/sync';
import type { LessonWithDetails } from '../types/lesson';

interface PendingSubmissionRowProps {
  lesson: LessonWithDetails;
  onRetry: (id: string) => void;
}

// Spec 008 FR-015 + T026 — list row for /sync.
// Action area varies by sync_status:
//   QUEUED   → "Tentar agora" button
//   SENDING  → disabled spinner
//   REJECTED → red indicator + "Tentar novamente" (recoverable after
//              catalog write-back; e.g. fix missing professor and re-enqueue)
export function PendingSubmissionRow({ lesson, onRetry }: PendingSubmissionRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isQueued = lesson.sync_status === SyncStatus.QUEUED;
  const isSending = lesson.sync_status === SyncStatus.SENDING;
  const isRejected = lesson.sync_status === SyncStatus.REJECTED;

  const title =
    lesson.topic_title || lesson.lesson_title || lesson.series_name || 'Aula';
  const professor =
    lesson.professor_name_resolved || lesson.professor_name || '';

  return (
    <View
      style={[
        styles.container,
        isRejected && styles.containerRejected,
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle}>
          {lesson.date}
          {professor ? ` — ${professor}` : ''}
        </Text>

        {isRejected && lesson.sync_error && (
          <Text
            style={styles.error}
            numberOfLines={3}
            accessibilityRole="alert"
            accessibilityLabel={`Envio rejeitado: ${title}. ${lesson.sync_error}`}
          >
            {lesson.sync_error}
          </Text>
        )}
      </View>

      <View style={styles.action}>
        {isQueued && (
          <AnimatedPressable
            onPress={() => onRetry(lesson.id)}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Tentar enviar agora"
          >
            <Ionicons
              name="refresh"
              size={16}
              color={theme.colors.background}
              accessible={false}
            />
            <Text style={styles.retryText}>Tentar agora</Text>
          </AnimatedPressable>
        )}

        {isSending && (
          <View style={styles.sendingIndicator}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}

        {isRejected && (
          <View style={styles.rejectedAction}>
            <Ionicons
              name="alert-circle"
              size={22}
              color={theme.colors.danger}
              accessible={false}
            />
            <AnimatedPressable
              onPress={() => onRetry(lesson.id)}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Tentar enviar novamente"
            >
              <Ionicons
                name="refresh"
                size={16}
                color={theme.colors.background}
                accessible={false}
              />
              <Text style={styles.retryText}>Tentar novamente</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    containerRejected: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.danger,
    },
    body: {
      flex: 1,
    },
    title: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    subtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs / 2,
    },
    error: {
      ...theme.typography.caption,
      color: theme.colors.danger,
      marginTop: theme.spacing.xs,
    },
    action: {
      justifyContent: 'center',
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      gap: theme.spacing.xs,
    },
    retryText: {
      color: theme.colors.background,
      ...theme.typography.caption,
      fontWeight: '600',
    },
    sendingIndicator: {
      paddingHorizontal: theme.spacing.sm,
    },
    rejectedAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
  });
