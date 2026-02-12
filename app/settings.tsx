import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useTheme } from "../src/hooks/useTheme";
import { Theme } from "../src/theme";
import { ThemePreference } from "../src/hooks/useThemePreference";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../src/components/AnimatedPressable";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "light", label: "Claro", icon: "sunny-outline" },
  { value: "dark", label: "Escuro", icon: "moon-outline" },
  { value: "system", label: "Sistema", icon: "phone-portrait-outline" },
];

export default function SettingsScreen() {
  const { theme, themePreference, setThemePreference } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
    },
    section: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
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
