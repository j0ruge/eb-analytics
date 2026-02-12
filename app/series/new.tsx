import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { seriesService } from "../../src/services/seriesService";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";

export default function NewSeriesScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
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
          <View style={styles.labelRow}>
            <Ionicons name="code-slash-outline" size={16} color={theme.colors.text} />
            <Text style={styles.label}>Código *</Text>
          </View>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Ex: EB354"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="characters"
            maxLength={20}
          />
          <Text style={styles.hint}>
            Identificador único da série (será convertido para maiúsculas)
          </Text>
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Ionicons name="text-outline" size={16} color={theme.colors.text} />
            <Text style={styles.label}>Título *</Text>
          </View>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Tempo de Despertar"
            placeholderTextColor={theme.colors.textSecondary}
            maxLength={100}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Ionicons name="document-text-outline" size={16} color={theme.colors.text} />
            <Text style={styles.label}>Descrição</Text>
          </View>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descrição opcional da série..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        <AnimatedPressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Salvando..." : "Criar Série"}
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.typography.body,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  hint: {
    ...theme.typography.caption,
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
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "600",
  },
});
