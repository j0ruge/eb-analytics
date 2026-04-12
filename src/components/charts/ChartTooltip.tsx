import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../theme';

interface ChartTooltipProps {
  visible: boolean;
  lines: string[];
  onViewLesson: () => void;
  onDismiss: () => void;
}

export function ChartTooltip({
  visible,
  lines,
  onViewLesson,
  onDismiss,
}: ChartTooltipProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!visible) return null;

  return (
    <>
      <Pressable
        style={styles.overlay}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Fechar tooltip"
      />
      <View style={styles.tooltip} accessibilityRole="alert">
        {lines.map((line, idx) => (
          <Text key={idx} style={styles.line}>
            {line}
          </Text>
        ))}
        <Pressable
          style={styles.linkRow}
          onPress={onViewLesson}
          accessibilityRole="link"
          accessibilityLabel="Ver aula"
        >
          <Text style={styles.link}>Ver aula →</Text>
        </Pressable>
      </View>
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
    },
    tooltip: {
      position: 'absolute',
      top: '30%',
      left: '10%',
      right: '10%',
      backgroundColor: theme.colors.chartTooltipBackground,
      borderColor: theme.colors.chartTooltipBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      ...theme.shadows.lg,
    },
    line: {
      ...theme.typography.body,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    linkRow: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopColor: theme.colors.borderLight,
      borderTopWidth: 1,
    },
    link: {
      ...theme.typography.body,
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });
