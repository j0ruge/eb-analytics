import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { Theme } from "../theme";
import { AnimatedPressable } from "./AnimatedPressable";

interface ErrorRetryProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorRetry({
  message = "Ocorreu um erro ao carregar os dados",
  onRetry,
}: ErrorRetryProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Ionicons
        name="alert-circle-outline"
        size={48}
        color={theme.colors.danger}
      />
      <Text style={styles.message}>{message}</Text>
      <AnimatedPressable style={styles.retryButton} onPress={onRetry}>
        <Ionicons
          name="refresh-outline"
          size={18}
          color={theme.colors.background}
        />
        <Text style={styles.retryText}>Tentar novamente</Text>
      </AnimatedPressable>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
      minHeight: 200,
    },
    message: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    retryText: {
      ...theme.typography.body,
      color: theme.colors.background,
      fontWeight: "600",
      marginLeft: theme.spacing.xs,
    },
  });
