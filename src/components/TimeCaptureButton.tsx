import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ToastAndroid } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../theme';

interface TimeCaptureButtonProps {
  label: string;
  value: string | null;
  onCapture: () => void;
  onClear?: () => void;
  onManualSet?: (time: string) => void;
  disabled?: boolean;
}

export function TimeCaptureButton({
  label,
  value,
  onCapture,
  onClear,
  onManualSet,
  disabled
}: TimeCaptureButtonProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

  const showProtectedMessage = () => {
    if (Platform.OS === 'android') {
      ToastAndroid.show('⏱️ Segure para editar', ToastAndroid.SHORT);
    } else {
      Alert.alert('', 'Segure o botão para editar o horário');
    }
  };

  const handlePress = () => {
    if (disabled) return;

    // Se vazio, captura imediatamente
    if (!value) {
      onCapture();
      return;
    }

    // Se preenchido, mostra mensagem
    showProtectedMessage();
  };

  const handleLongPress = () => {
    if (disabled || !value) return;

    // Mostra opções
    Alert.alert(
      'Alterar Horário',
      `Horário atual: ${value}`,
      [
        {
          text: '🔄 Atualizar para Agora',
          onPress: () => onCapture(),
        },
        {
          text: '✏️ Editar Manualmente',
          onPress: () => {
            // Parse do horário atual para inicializar o picker
            if (value) {
              const [hours, minutes] = value.split(':').map(Number);
              const now = new Date();
              now.setHours(hours, minutes, 0, 0);
              setTempTime(now);
            }
            setShowTimePicker(true);
          },
        },
        {
          text: '❌ Limpar',
          style: 'destructive',
          onPress: () => {
            if (onClear) {
              onClear();
            }
          },
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');

    if (event.type === 'set' && selectedTime && onManualSet) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      onManualSet(`${hours}:${minutes}`);
    }
  };

  return (
    <View style={[styles.container, disabled && styles.disabledContainer]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.button,
          value && styles.buttonFilled,
          disabled && styles.disabledButton
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={800}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.buttonText,
          value && styles.buttonTextFilled,
          disabled && styles.disabledText
        ]}>
          {value || (disabled ? '--:--' : '⏱️ Capturar')}
        </Text>
        {value && !disabled && (
          <Text style={styles.hintText}>Segure para editar</Text>
        )}
      </TouchableOpacity>

      {showTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
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
    minHeight: 60,
    justifyContent: 'center',
  },
  buttonFilled: {
    backgroundColor: theme.colors.primary + '10', // 10% opacity
    borderColor: theme.colors.primary,
    borderWidth: 2,
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
  buttonTextFilled: {
    fontSize: 20,
    color: theme.colors.primary,
  },
  disabledText: {
    color: theme.colors.textSecondary,
  },
  hintText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
