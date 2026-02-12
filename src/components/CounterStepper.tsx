import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Theme } from '../theme';
import { AnimatedPressable } from './AnimatedPressable';

interface CounterStepperProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export function CounterStepper({ label, value, onIncrement, onDecrement, disabled }: CounterStepperProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, disabled && styles.disabledContainer]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.controls, disabled && styles.disabledControls]}>
        <AnimatedPressable
          style={[styles.button, disabled && styles.disabledButton]}
          onPress={onDecrement}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>-</Text>
        </AnimatedPressable>

        <View style={styles.valueContainer}>
          <Text style={[styles.value, disabled && styles.disabledValue]}>{value}</Text>
        </View>

        <AnimatedPressable
          style={[styles.button, disabled && styles.disabledButton]}
          onPress={onIncrement}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>+</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },
  disabledContainer: {
    opacity: 0.7,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
  },
  disabledControls: {
    backgroundColor: theme.colors.borderLight,
  },
  button: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: theme.colors.textSecondary,
  },
  buttonText: {
    color: theme.colors.background,
    fontSize: 24,
    fontWeight: 'bold',
  },
  valueContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  disabledValue: {
    color: theme.colors.textSecondary,
  },
});
