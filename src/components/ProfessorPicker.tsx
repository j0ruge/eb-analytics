import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { professorService } from "../services/professorService";
import { Professor } from "../types/professor";
import { theme } from "../theme";

interface ProfessorPickerProps {
  label: string;
  selectedProfessorId: string | null;
  onSelect: (professorId: string) => void;
  disabled?: boolean;
}

export function ProfessorPicker({
  label,
  selectedProfessorId,
  onSelect,
  disabled,
}: ProfessorPickerProps) {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const router = useRouter();

  // Recarrega lista quando a tela volta ao foco
  useFocusEffect(
    React.useCallback(() => {
      loadProfessors();
    }, []),
  );

  async function loadProfessors() {
    try {
      setLoading(true);
      const data = await professorService.getAllProfessors();
      setProfessors(data);
    } catch (error) {
      console.error("Error loading professors:", error);
    } finally {
      setLoading(false);
    }
  }

  function handlePress() {
    if (disabled) return;

    if (professors.length === 0) {
      Alert.alert(
        "Nenhum professor cadastrado",
        "Cadastre um professor primeiro.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Cadastrar Professor",
            onPress: () => router.push("/professors/new" as any),
          },
        ],
      );
      return;
    }

    setShowPicker(!showPicker);
  }

  function handleSelect(professor: Professor) {
    onSelect(professor.id);
    setShowPicker(false);
  }

  const selectedProfessor = professors.find(
    (p) => p.id === selectedProfessorId,
  );

  return (
    <View style={[styles.container, disabled && styles.disabledContainer]}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.selector, disabled && styles.disabledSelector]}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        <Text
          style={[
            styles.selectorText,
            !selectedProfessor && styles.placeholder,
          ]}
        >
          {loading
            ? "Carregando..."
            : selectedProfessor?.name || "Selecione o professor"}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={styles.pickerContainer}>
          {professors.map((professor) => (
            <TouchableOpacity
              key={professor.id}
              style={[
                styles.pickerItem,
                professor.id === selectedProfessorId &&
                  styles.pickerItemSelected,
              ]}
              onPress={() => handleSelect(professor)}
            >
              <Text style={styles.pickerItemText}>{professor.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  selector: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  disabledSelector: {
    backgroundColor: "#E5E5EA",
  },
  selectorText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textSecondary,
  },
  arrow: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 200,
  },
  pickerItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.primary,
  },
  pickerItemText: {
    fontSize: 16,
    color: theme.colors.text,
  },
});
