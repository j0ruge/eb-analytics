import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { Theme } from "../theme";
import { LessonStatus, STATUS_LABELS } from "../types/lesson";
import { AnimatedPressable } from "./AnimatedPressable";

interface StatusFilterBarProps {
  activeFilters: LessonStatus[];
  onFilterChange: (filters: LessonStatus[]) => void;
}

export function StatusFilterBar({
  activeFilters,
  onFilterChange,
}: StatusFilterBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const allStatuses = Object.values(LessonStatus);

  function toggleFilter(status: LessonStatus) {
    const isActive = activeFilters.includes(status);

    if (isActive) {
      onFilterChange(activeFilters.filter((s) => s !== status));
    } else {
      onFilterChange([...activeFilters, status]);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {allStatuses.map((status) => {
          const isActive = activeFilters.includes(status);
          return (
            <AnimatedPressable
              key={status}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => toggleFilter(status)}
            >
              <Text
                style={[styles.pillText, isActive && styles.pillTextActive]}
              >
                {STATUS_LABELS[status]}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      paddingVertical: theme.spacing.sm,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    pill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      height: 40,
      justifyContent: "center",
    },
    pillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    pillText: {
      ...theme.typography.label,
      color: theme.colors.text,
    },
    pillTextActive: {
      color: theme.colors.background,
    },
  });
