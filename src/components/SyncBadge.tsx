import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useSyncQueue } from '../hooks/useSyncQueue';
import { AnimatedPressable } from './AnimatedPressable';
import { Theme } from '../theme';

// Home-header badge: count of QUEUED|SENDING rows for the current user.
// Hidden entirely when the count is 0 (spec 008 FR-014 acceptance 3).
export function SyncBadge() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const { pending } = useSyncQueue();
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (isLoading || !isAuthenticated || pending === 0) {
    return null;
  }

  return (
    <AnimatedPressable
      style={styles.container}
      onPress={() => router.push('/(tabs)/sync' as never)}
      accessibilityLabel={`${pending} submissões pendentes`}
    >
      <Ionicons
        name="cloud-upload-outline"
        size={18}
        color={theme.colors.background}
      />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{pending}</Text>
      </View>
    </AnimatedPressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: theme.colors.background,
      fontSize: 11,
      fontWeight: 'bold',
    },
  });
