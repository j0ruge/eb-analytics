import React, { useMemo } from "react";
import { Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { Theme } from "../theme";
import { AnimatedPressable } from "./AnimatedPressable";

interface FABProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
}

export function FAB({ onPress, icon = "add", label }: FABProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <AnimatedPressable onPress={onPress} style={styles.fab}>
      <Ionicons name={icon} size={label ? 20 : 28} color={theme.colors.background} />
      {label && <Text style={styles.label}>{label}</Text>}
    </AnimatedPressable>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  fab: {
    position: "absolute",
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 28,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    minWidth: 56,
    minHeight: 56,
    justifyContent: "center",
    ...theme.shadows.lg,
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "bold",
    marginLeft: theme.spacing.xs,
  },
});
