import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ToastAndroid,
  Modal,
  Pressable,
} from 'react-native';
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
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

  const showProtectedMessage = () => {
    if (Platform.OS === 'android') {
      ToastAndroid.show('⏱️ Segure para editar', ToastAndroid.SHORT);
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
    setShowOptionsModal(true);
  };

  const handleUpdateNow = () => {
    setShowOptionsModal(false);
    onCapture();
  };

  const handleEditManually = () => {
    setShowOptionsModal(false);

    // Parse do horário atual para inicializar o picker
    if (value) {
      const [hours, minutes] = value.split(':').map(Number);
      const now = new Date();
      now.setHours(hours, minutes, 0, 0);
      setTempTime(now);
    }

    setTimeout(() => setShowTimePicker(true), 300);
  };

  const handleClear = () => {
    setShowOptionsModal(false);
    if (onClear) {
      onClear();
    }
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

      {/* Modal de Opções */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOptionsModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTimeDisplay}>
                <Text style={styles.modalTimeLabel}>Horário Atual</Text>
                <Text style={styles.modalTimeValue}>{value}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowOptionsModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Opções */}
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[styles.optionCard, styles.optionPrimary]}
                onPress={handleUpdateNow}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Text style={styles.optionIcon}>🔄</Text>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Atualizar para Agora</Text>
                  <Text style={styles.optionDescription}>
                    Captura o horário atual
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, styles.optionSecondary]}
                onPress={handleEditManually}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Text style={styles.optionIcon}>✏️</Text>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Editar Manualmente</Text>
                  <Text style={styles.optionDescription}>
                    Escolher horário específico
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, styles.optionDanger]}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Text style={styles.optionIcon}>🗑️</Text>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, styles.optionTitleDanger]}>
                    Limpar Horário
                  </Text>
                  <Text style={styles.optionDescription}>
                    Remove o horário registrado
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionCard, styles.optionCancel]}
                onPress={() => setShowOptionsModal(false)}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Text style={styles.optionIcon}>✖️</Text>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Cancelar</Text>
                  <Text style={styles.optionDescription}>
                    Fechar sem fazer alterações
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* DateTimePicker */}
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
    backgroundColor: theme.colors.primary + '10',
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTimeDisplay: {
    flex: 1,
  },
  modalTimeLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  modalTimeValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '300',
  },
  optionsContainer: {
    padding: theme.spacing.lg,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionPrimary: {
    backgroundColor: theme.colors.primary + '08',
    borderColor: theme.colors.primary + '30',
  },
  optionSecondary: {
    backgroundColor: '#4A90E2' + '08',
    borderColor: '#4A90E2' + '30',
  },
  optionDanger: {
    backgroundColor: '#FF3B30' + '08',
    borderColor: '#FF3B30' + '30',
  },
  optionCancel: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    marginBottom: 0,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  optionTitleDanger: {
    color: '#FF3B30',
  },
  optionDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
