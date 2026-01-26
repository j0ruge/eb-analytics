import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { professorService } from "../../src/services/professorService";
import { theme } from "../../src/theme";

export default function NewProfessorScreen() {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function formatCpfInput(text: string) {
    // Remove tudo que não é número
    const numbers = text.replace(/\D/g, "");

    // Limita a 11 dígitos
    const limited = numbers.slice(0, 11);

    // Formata: 000.000.000-00
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
    // Validações básicas
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
      await professorService.createProfessor({
        name: name.trim(),
        doc_id: cpf,
      });

      Alert.alert("Sucesso", "Professor cadastrado com sucesso", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error ? error.message : "Erro ao cadastrar professor",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.form}>
        <Text style={styles.label}>Nome Completo *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Digite o nome completo"
          autoCapitalize="words"
          editable={!loading}
        />

        <Text style={styles.label}>CPF *</Text>
        <TextInput
          style={styles.input}
          value={cpf}
          onChangeText={handleCpfChange}
          placeholder="000.000.000-00"
          keyboardType="numeric"
          maxLength={14}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Salvando..." : "Salvar Professor"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  form: {
    padding: theme.spacing.md,
  },
  label: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
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
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
