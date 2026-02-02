import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { LessonStatus } from '../types/lesson';

const STATUS_LABELS: Record<LessonStatus, string> = {
  [LessonStatus.IN_PROGRESS]: 'Em Andamento',
  [LessonStatus.COMPLETED]: 'Completa',
  [LessonStatus.EXPORTED]: 'Exportada',
  [LessonStatus.SYNCED]: 'Sincronizada',
};

interface StatusFilterBarProps {
  activeFilters: LessonStatus[];
  onFilterChange: (filters: LessonStatus[]) => void;
}

export function StatusFilterBar({ activeFilters, onFilterChange }: StatusFilterBarProps) {
  const allStatuses = Object.values(LessonStatus);

  function toggleFilter(status: LessonStatus) {
    const isActive = activeFilters.includes(status);

    if (isActive) {
      onFilterChange(activeFilters.filter(s => s !== status));
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
        {allStatuses.map(status => {
          const isActive = activeFilters.includes(status);
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.pill,
                isActive && styles.pillActive,
              ]}
              onPress={() => toggleFilter(status)}
            >
              <Text style={[
                styles.pillText,
                isActive && styles.pillTextActive,
              ]}>
                {STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  pillTextActive: {
    color: '#fff',
  },
});
