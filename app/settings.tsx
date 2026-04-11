import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { useMemo, useState } from "react";
import { useTheme } from "../src/hooks/useTheme";
import { Theme } from "../src/theme";
import { ThemePreference } from "../src/hooks/useThemePreference";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { seedService } from "../src/services/seedService";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "light", label: "Claro", icon: "sunny-outline" },
  { value: "dark", label: "Escuro", icon: "moon-outline" },
  { value: "system", label: "Sistema", icon: "phone-portrait-outline" },
];

const extractMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export default function SettingsScreen() {
  const { theme, themePreference, setThemePreference } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [seedLoading, setSeedLoading] = useState(false);

  const handleSeed = async () => {
    if (seedLoading) return;
    setSeedLoading(true);
    try {
      const result = await seedService.seed();
      if (result.skipped) {
        Alert.alert("Seed já aplicado", result.reason ?? "Nada a fazer.");
      } else {
        Alert.alert(
          "Dados de exemplo carregados",
          `Séries: ${result.series}\nTópicos: ${result.topics}\nProfessores: ${result.professors}\nAulas: ${result.lessons}`,
        );
      }
    } catch (err) {
      console.error("Seed error:", err);
      Alert.alert("Erro ao carregar", extractMessage(err));
    } finally {
      setSeedLoading(false);
    }
  };

  const handleClearSeed = () => {
    Alert.alert(
      "Remover dados de exemplo?",
      "Isso apaga apenas as entradas com prefixo seed-*. Dados criados por você não são afetados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await seedService.clearSeed();
              Alert.alert(
                "Seed removido",
                `Aulas: ${result.lessons}\nTópicos: ${result.topics}\nSéries: ${result.series}\nProfessores: ${result.professors}`,
              );
            } catch (err) {
              console.error("Clear seed error:", err);
              Alert.alert("Erro", extractMessage(err));
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aparência</Text>
        <Text style={styles.sectionDescription}>
          Escolha como o app deve ser exibido
        </Text>

        <View style={styles.optionsContainer}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = themePreference === option.value;
            return (
              <AnimatedPressable
                key={option.value}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => setThemePreference(option.value)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Tema ${option.label}`}
                accessibilityState={{ selected: isSelected }}
                accessibilityHint="Toque para selecionar este tema"
              >
                <Ionicons
                  name={option.icon}
                  size={28}
                  color={
                    isSelected
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                />
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.colors.primary}
                    style={styles.checkIcon}
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                  />
                )}
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {__DEV__ && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Desenvolvimento</Text>
          <Text style={styles.sectionDescription}>
            Ferramentas para popular o banco com dados reais coletados até agora
          </Text>

          <View style={styles.devActions}>
            <AnimatedPressable
              style={[styles.devButton, seedLoading && styles.devButtonDisabled]}
              onPress={handleSeed}
              disabled={seedLoading}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Carregar dados de exemplo"
              accessibilityHint="Toque para popular o banco com dados de exemplo"
              accessibilityState={{ disabled: seedLoading }}
            >
              <Ionicons
                name={seedLoading ? "hourglass-outline" : "download-outline"}
                size={22}
                color={theme.colors.primary}
              />
              <Text style={styles.devButtonLabel}>
                {seedLoading ? "Carregando..." : "Carregar dados de exemplo"}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.devButton, styles.devButtonDanger]}
              onPress={handleClearSeed}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Remover dados de exemplo"
              accessibilityHint="Toque para remover os dados de exemplo do banco"
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={theme.colors.danger}
              />
              <Text style={[styles.devButtonLabel, styles.devButtonLabelDanger]}>
                Remover dados de exemplo
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    contentContainer: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    section: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
    },
    devActions: {
      gap: theme.spacing.sm,
    },
    devButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    devButtonDanger: {
      borderColor: theme.colors.danger,
    },
    devButtonDisabled: {
      opacity: 0.5,
    },
    devButtonLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
    },
    devButtonLabelDanger: {
      color: theme.colors.danger,
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    sectionDescription: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
    },
    optionsContainer: {
      gap: theme.spacing.sm,
    },
    optionCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 2,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    optionCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    optionLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      marginLeft: theme.spacing.md,
      flex: 1,
    },
    optionLabelSelected: {
      fontWeight: "600",
      color: theme.colors.primary,
    },
    checkIcon: {
      marginLeft: theme.spacing.sm,
    },
  });
