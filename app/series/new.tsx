import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { seriesService } from "../../src/services/seriesService";
import { theme } from "../../src/theme";

export default function NewSeriesScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    // Validações
    if (!code.trim()) {
      Alert.alert("Erro", "O código da série é obrigatório.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Erro", "O título da série é obrigatório.");
      return;
    }

    try {
      setSaving(true);
      await seriesService.createSeries({
        code: code.trim(),
        title: title.trim(),
        description: description.trim() || null,
      });
      router.back();
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível criar a série.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.label}>Código *</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Ex: EB354"
            autoCapitalize="characters"
            maxLength={20}
          />
          <Text style={styles.hint}>
            Identificador único da série (será convertido para maiúsculas)
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Tempo de Despertar"
            maxLength={100}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descrição opcional da série..."
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Salvando..." : "Criar Série"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  content: {
    padding: theme.spacing.md,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    marginTop: theme.spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
