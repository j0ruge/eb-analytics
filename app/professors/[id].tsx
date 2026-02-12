import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { professorService } from "../../src/services/professorService";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";

export default function EditProfessorScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadProfessor();
  }, [id]);

  async function loadProfessor() {
    if (!id) return;

    try {
      const professor = await professorService.getById(id);
      if (professor) {
        setName(professor.name);
        setCpf(formatCpfDisplay(professor.doc_id));
      } else {
        Alert.alert("Erro", "Professor não encontrado", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      Alert.alert("Erro", "Erro ao carregar professor", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setInitialLoading(false);
    }
  }

  function formatCpfDisplay(cpf: string): string {
    const numbers = cpf.replace(/\D/g, "");
    if (numbers.length !== 11) return cpf;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  }

  function formatCpfInput(text: string) {
    const numbers = text.replace(/\D/g, "");
    const limited = numbers.slice(0, 11);

    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}.${limited.slice(3)}`;
    } else if (limited.length <= 9) {
      return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
    } else {
      return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
    }
  }

  function handleCpfChange(text: string) {
    setCpf(formatCpfInput(text));
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Erro", "Nome é obrigatório");
      return;
    }

    if (!cpf.trim()) {
      Alert.alert("Erro", "CPF é obrigatório");
      return;
    }

    setLoading(true);
    try {
      await professorService.updateProfessor(id!, {
        name: name.trim(),
        doc_id: cpf,
      });

      Alert.alert("Sucesso", "Professor atualizado com sucesso", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Erro ao atualizar professor"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja excluir este professor?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: confirmDelete,
        },
      ]
    );
  }

  async function confirmDelete() {
    setLoading(true);
    try {
      await professorService.deleteProfessor(id!);

      Alert.alert("Sucesso", "Professor excluído com sucesso", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Erro ao excluir professor"
      );
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.form}>
        <View style={styles.labelRow}>
          <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.label}>Nome Completo *</Text>
        </View>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Digite o nome completo"
          placeholderTextColor={theme.colors.textSecondary}
          autoCapitalize="words"
          editable={!loading}
        />

        <View style={styles.labelRow}>
          <Ionicons name="card-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={styles.label}>CPF *</Text>
        </View>
        <TextInput
          style={styles.input}
          value={cpf}
          onChangeText={handleCpfChange}
          placeholder="000.000.000-00"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="numeric"
          maxLength={14}
          editable={!loading}
        />

        <AnimatedPressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Salvando..." : "Salvar Alterações"}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          style={[styles.deleteButton, loading && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={loading}
        >
          <Text style={styles.deleteButtonText}>
            {loading ? "Processando..." : "Excluir Professor"}
          </Text>
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  form: {
    padding: theme.spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.textSecondary,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.typography.body,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    marginTop: theme.spacing.xl,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  buttonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: theme.colors.danger,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  deleteButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "bold",
  },
});
