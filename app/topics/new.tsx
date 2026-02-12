import { useState, useEffect, useMemo } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { topicService } from "../../src/services/topicService";
import { seriesService } from "../../src/services/seriesService";
import { LessonSeries } from "../../src/types/lessonSeries";
import { useTheme } from "../../src/hooks/useTheme";
import { Theme } from "../../src/theme";
import { DatePickerInput } from "../../src/components/DatePickerInput";
import { AnimatedPressable } from "../../src/components/AnimatedPressable";

export default function NewTopicScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
          <View style={styles.labelRow}>
            <Ionicons name="text-outline" size={16} color={theme.colors.text} />
            <Text style={styles.label}>Título da Lição *</Text>
          </View>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Lição 01 - O Início"
            placeholderTextColor={theme.colors.textSecondary}
            maxLength={150}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Ionicons name="list-outline" size={16} color={theme.colors.text} />
            <Text style={styles.label}>Ordem Sequencial</Text>
          </View>
          <TextInput
            style={styles.input}
            value={sequenceOrder}
            onChangeText={setSequenceOrder}
            placeholder="Ex: 1, 2, 3..."
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="number-pad"
            maxLength={5}
          />
          <Text style={styles.hint}>
            Se não informado, será definido automaticamente
          </Text>
        </View>

        <DatePickerInput
          label="Data Sugerida"
          value={suggestedDate || null}
          onChange={setSuggestedDate}
          placeholder="Selecione uma data"
        />
        <Text style={styles.hint}>
          Data prevista na revista (apenas informativo)
        </Text>

        <AnimatedPressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Salvando..." : "Criar Lição"}
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
  seriesInfo: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  seriesLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  seriesName: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.primary,
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
