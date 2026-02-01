import { useState, useEffect } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { topicService } from "../../src/services/topicService";
import { seriesService } from "../../src/services/seriesService";
import { LessonSeries } from "../../src/types/lessonSeries";
import { theme } from "../../src/theme";

export default function NewTopicScreen() {
  const { seriesId } = useLocalSearchParams<{ seriesId: string }>();
  const router = useRouter();
  const [series, setSeries] = useState<LessonSeries | null>(null);
  const [title, setTitle] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [sequenceOrder, setSequenceOrder] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSeries();
  }, [seriesId]);

  async function loadSeries() {
    if (seriesId) {
      const data = await seriesService.getSeriesById(seriesId);
      setSeries(data);
    }
  }

  async function handleSave() {
    if (!seriesId) {
      Alert.alert("Erro", "Série não identificada.");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Erro", "O título da lição é obrigatório.");
      return;
    }

    const order = sequenceOrder ? parseInt(sequenceOrder, 10) : 0;
    if (sequenceOrder && (isNaN(order) || order < 1)) {
      Alert.alert("Erro", "A ordem deve ser um número maior que zero.");
      return;
    }

    try {
      setSaving(true);
      await topicService.createTopic({
        series_id: seriesId,
        title: title.trim(),
        suggested_date: suggestedDate.trim() || null,
        sequence_order: order || 1,
      });
      router.back();
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível criar a lição.");
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
        {series && (
          <View style={styles.seriesInfo}>
            <Text style={styles.seriesLabel}>Série:</Text>
            <Text style={styles.seriesName}>
              {series.code} - {series.title}
            </Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Título da Lição *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Lição 01 - O Início"
            maxLength={150}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ordem Sequencial</Text>
          <TextInput
            style={styles.input}
            value={sequenceOrder}
            onChangeText={setSequenceOrder}
            placeholder="Ex: 1, 2, 3..."
            keyboardType="number-pad"
            maxLength={5}
          />
          <Text style={styles.hint}>
            Se não informado, será definido automaticamente
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Data Sugerida</Text>
          <TextInput
            style={styles.input}
            value={suggestedDate}
            onChangeText={setSuggestedDate}
            placeholder="Ex: 2026-02-15 (AAAA-MM-DD)"
            maxLength={10}
          />
          <Text style={styles.hint}>
            Data prevista na revista (apenas informativo)
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Salvando..." : "Criar Lição"}
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
  seriesInfo: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  seriesLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  seriesName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primary,
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
