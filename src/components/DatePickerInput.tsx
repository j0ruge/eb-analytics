import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../hooks/useTheme";
import { Theme } from "../theme";
import { parseInputDate, formatToYYYYMMMDD } from "../utils/date";
import { AnimatedPressable } from "./AnimatedPressable";

interface DatePickerInputProps {
  label: string;
  value: string | null;
  onChange: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DatePickerInput({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "Selecione uma data",
}: DatePickerInputProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Parsear o valor atual ou usar data atual
  const currentDate = value ? parseInputDate(value) : null;

  const handleOpenPicker = () => {
    if (disabled) return;

    // Definir data inicial do picker
    const initialDate = currentDate || new Date();
    setTempDate(initialDate);
    setShowPicker(true);
  };

  const handleConfirm = () => {
    const formatted = formatToYYYYMMMDD(tempDate);
    onChange(formatted);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setShowPicker(false);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      // No Android, fechar automaticamente
      setShowPicker(false);

      if (event.type === "set" && selectedDate) {
        const formatted = formatToYYYYMMMDD(selectedDate);
        onChange(formatted);
      }
    } else if (selectedDate) {
      // No iOS, apenas atualizar a data temporária
      setTempDate(selectedDate);
    }
  };

  // Formatar valor para exibição
  const displayValue = currentDate ? formatToYYYYMMMDD(currentDate) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <AnimatedPressable
        style={[
          styles.button,
          disabled && styles.buttonDisabled,
          displayValue && styles.buttonFilled,
        ]}
        onPress={handleOpenPicker}
        disabled={disabled}
      >
        <Text
          style={[
            styles.buttonText,
            !displayValue && styles.buttonTextPlaceholder,
            disabled && styles.buttonTextDisabled,
          ]}
        >
          {displayValue || placeholder}
        </Text>
      </AnimatedPressable>

      {/* Modal para iOS */}
      {Platform.OS === "ios" && showPicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showPicker}
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.modalButtonCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.modalButtonConfirm}>Confirmar</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Picker inline para Android */}
      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginVertical: theme.spacing.sm,
    },
    label: {
      ...theme.typography.label,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    button: {
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 50,
      justifyContent: "center",
    },
    buttonFilled: {
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
    },
    buttonDisabled: {
      opacity: 0.6,
      backgroundColor: theme.colors.borderLight,
    },
    buttonText: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    buttonTextPlaceholder: {
      color: theme.colors.textSecondary,
    },
    buttonTextDisabled: {
      color: theme.colors.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      paddingBottom: theme.spacing.xl,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalButtonCancel: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    modalButtonConfirm: {
      ...theme.typography.body,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    picker: {
      height: 200,
    },
  });
