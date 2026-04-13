import { useMemo, useState } from "react";

import { View, Text, StyleSheet, Alert, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";

import { useTheme } from "../src/hooks/useTheme";
import { useAuth } from "../src/hooks/useAuth";
import { Theme } from "../src/theme";
import { ThemePreference } from "../src/hooks/useThemePreference";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedPressable } from "../src/components/AnimatedPressable";
import { seedService } from "../src/services/seedService";
import { useIncludesProfessorDefault } from "../src/hooks/useIncludesProfessorDefault";
import { Role } from "../src/types/auth";

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
  const router = useRouter();
  const { theme, themePreference, setThemePreference } = useTheme();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [seedLoading, setSeedLoading] = useState(false);
  const {
    value: includesProfessorDefault,
    setValue: setIncludesProfessorDefault,
  } = useIncludesProfessorDefault();

  const handleLogout = () => {
    Alert.alert("Sair da conta?", "Seus dados locais continuam salvos.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (err) {
            console.error("Logout error:", err);
            Alert.alert("Erro", "Não foi possível sair da conta");
          }
        },
      },
    ]);
  };

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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Padrões</Text>
        <Text style={styles.sectionDescription}>
          Valores iniciais aplicados a cada nova aula criada
        </Text>
        <View style={styles.defaultRow}>
          <Text style={styles.defaultLabel}>
            Incluir professor nas contagens por padrão
          </Text>
          <Switch
            value={includesProfessorDefault}
            onValueChange={setIncludesProfessorDefault}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.colors.surface}
            accessibilityRole="switch"
            accessibilityLabel="Incluir professor nas contagens por padrão"
          />
        </View>
      </View>

      {!authLoading && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <Text style={styles.sectionDescription}>
          {isAuthenticated
            ? "Gerencie sua conta"
            : "Entre ou crie uma conta para sincronizar"}
        </Text>

        {isAuthenticated ? (
          <View style={styles.accountActions}>
            <View style={styles.userInfoCard}>
              <Ionicons
                name="person-circle-outline"
                size={40}
                color={theme.colors.primary}
              />
              <View style={styles.userInfoText}>
                <Text style={styles.userName}>
                  {user?.display_name || user?.email}
                </Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {user?.role === Role.COORDINATOR
                      ? "Coordenador"
                      : "Coletor"}
                  </Text>
                </View>
              </View>
            </View>

            <AnimatedPressable
              style={[styles.devButton, styles.devButtonDanger]}
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Sair"
            >
              <Ionicons
                name="log-out-outline"
                size={22}
                color={theme.colors.danger}
              />
              <Text style={[styles.devButtonLabel, styles.devButtonLabelDanger]}>
                Sair
              </Text>
            </AnimatedPressable>
          </View>
        ) : (
          <View style={styles.accountActions}>
            <AnimatedPressable
              style={styles.devButton}
              onPress={() => router.push("/login")}
              accessibilityRole="button"
              accessibilityLabel="Entrar"
            >
              <Ionicons
                name="log-in-outline"
                size={22}
                color={theme.colors.primary}
              />
              <Text style={styles.devButtonLabel}>Entrar</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.devButton}
              onPress={() => router.push("/register")}
              accessibilityRole="button"
              accessibilityLabel="Criar conta"
            >
              <Ionicons
                name="person-add-outline"
                size={22}
                color={theme.colors.primary}
              />
              <Text style={styles.devButtonLabel}>Criar conta</Text>
            </AnimatedPressable>
          </View>
        )}
      </View>
      )}

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
    accountActions: {
      gap: theme.spacing.sm,
    },
    userInfoCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    userInfoText: {
      flex: 1,
    },
    userName: {
      ...theme.typography.body,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    userEmail: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
    },
    roleBadge: {
      alignSelf: "flex-start",
      marginTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.primary,
    },
    roleBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.background,
      fontWeight: "bold",
    },
    defaultRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    defaultLabel: {
      ...theme.typography.body,
      color: theme.colors.text,
      flex: 1,
      marginRight: theme.spacing.sm,
    },
  });
