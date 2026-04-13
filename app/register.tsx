import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Theme } from "@/theme";
import { AnimatedPressable } from "@/components/AnimatedPressable";

export default function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const isFormValid =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    displayName.trim().length > 0;

  const handleRegister = async () => {
    if (!isFormValid || loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedEmail.includes("@")) {
      Alert.alert("Erro", "Email inválido");
      return;
    }

    if (trimmedName.length > 100) {
      Alert.alert("Erro", "Nome deve ter no máximo 100 caracteres");
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        email: trimmedEmail,
        password,
        display_name: trimmedName,
      });

      if (result.error) {
        Alert.alert("Erro", result.error);
        return;
      }

      if (result.isFirstUser) {
        Alert.alert("Conta criada", "Você é o coordenador deste grupo");
      } else {
        Alert.alert("Sucesso", "Conta criada com sucesso");
      }

      router.canGoBack() ? router.back() : router.replace("/");
    } catch {
      Alert.alert("Erro", "Erro no servidor, tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Seu nome"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="words"
            maxLength={100}
            accessibilityLabel="Nome"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={theme.colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Sua senha"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            accessibilityLabel="Senha"
          />

          <AnimatedPressable
            style={[
              styles.button,
              (!isFormValid || loading) && styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={!isFormValid || loading}
            accessibilityRole="button"
            accessibilityLabel="Registrar"
            accessibilityState={{ disabled: !isFormValid || loading }}
          >
            <Text style={styles.buttonText}>
              {loading ? "Registrando..." : "Registrar"}
            </Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    scrollContent: {
      padding: theme.spacing.lg,
    },
    form: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: "600",
      marginTop: theme.spacing.sm,
    },
    input: {
      ...theme.typography.body,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    button: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      marginTop: theme.spacing.lg,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      ...theme.typography.body,
      color: theme.colors.background,
      fontWeight: "bold",
    },
  });
