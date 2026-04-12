import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';

interface DashboardEmptyStateProps {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function DashboardEmptyState({
  message,
  icon = 'bar-chart-outline',
}: DashboardEmptyStateProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={theme.spacing.xxl} color={theme.colors.textTertiary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      minHeight: theme.spacing.xxl * 3 + theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.lg,
    },
    message: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
      textAlign: 'center',
    },
  });
