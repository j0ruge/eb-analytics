import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface TimeCaptureButtonProps {
  label: string;
  value: string | null;
  onCapture: () => void;
  disabled?: boolean;
}

export function TimeCaptureButton({ label, value, onCapture, disabled }: TimeCaptureButtonProps) {
  return (
    <View style={[styles.container, disabled && styles.disabledContainer]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity 
        style={[styles.button, disabled && styles.disabledButton]} 
        onPress={onCapture}
        disabled={disabled}
      >
        <Text style={[styles.buttonText, disabled && styles.disabledText]}>
          {value || (disabled ? '--:--' : 'Capturar Horário')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  disabledContainer: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  button: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#E5E5EA',
    borderColor: '#C6C6C8',
  },
  buttonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  disabledText: {
    color: theme.colors.textSecondary,
  },
});
