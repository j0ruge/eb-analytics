import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface CounterStepperProps {
  label: string;
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export function CounterStepper({ label, value, onIncrement, onDecrement, disabled }: CounterStepperProps) {
  return (
    <View style={[styles.container, disabled && styles.disabledContainer]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.controls, disabled && styles.disabledControls]}>
        <TouchableOpacity 
          style={[styles.button, disabled && styles.disabledButton]} 
          onPress={onDecrement}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>
        
        <View style={styles.valueContainer}>
          <Text style={[styles.value, disabled && styles.disabledValue]}>{value}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, disabled && styles.disabledButton]} 
          onPress={onIncrement}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },
  disabledContainer: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
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
    backgroundColor: '#E5E5EA',
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
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  valueContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  disabledValue: {
    color: theme.colors.textSecondary,
  },
});
