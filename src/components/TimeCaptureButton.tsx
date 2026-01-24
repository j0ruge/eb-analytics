import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface TimeCaptureButtonProps {
  label: string;
  value: string | null;
  onCapture: () => void;
}

export function TimeCaptureButton({ label, value, onCapture }: TimeCaptureButtonProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.button} onPress={onCapture}>
        <Text style={styles.buttonText}>
          {value || 'Capturar Horário'}
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
  buttonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
});
