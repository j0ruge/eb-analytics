import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';
import { ChartCardStatus } from '../../types/dashboard';

interface ChartCardProps {
  title: string;
  subtitlePrefix: string;
  status: ChartCardStatus;
  count: number;
  footnote?: string;
  errorMessage?: string;
  onRetry?: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  subtitlePrefix,
  status,
  count,
  footnote,
  errorMessage,
  onRetry,
  accessibilityLabel,
  children,
}: ChartCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const subtitle =
    status === 'success' && count > 0
      ? `Últimas ${count} aulas — ${subtitlePrefix}`
      : subtitlePrefix;

  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${subtitle}`}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {status === 'loading' && (
        <View style={styles.stateSlot}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}

      {status === 'error' && (
        <View style={styles.stateSlot}>
          <Text style={styles.errorText}>
            {errorMessage ?? 'Erro ao carregar este gráfico'}
          </Text>
          {onRetry && (
            <Pressable
              style={styles.retryButton}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          )}
        </View>
      )}

      {status === 'success' && (
        <>
          <View style={styles.chartSlot}>{children}</View>
          {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
        </>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.sm,
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
    subtitle: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.md,
    },
    chartSlot: {
      minHeight: 160,
    },
    stateSlot: {
      minHeight: 160,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.lg,
    },
    errorText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    retryText: {
      ...theme.typography.body,
      color: theme.colors.background,
      fontWeight: '600',
    },
    footnote: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.sm,
      textAlign: 'center',
    },
  });
