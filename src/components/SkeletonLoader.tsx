import React, { useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";
import { Theme } from "../theme";

interface SkeletonLoaderProps {
  count?: number;
}

function SkeletonCard({
  cardStyles,
}: {
  cardStyles: ReturnType<typeof createCardStyles>;
}) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[cardStyles.card, animatedStyle]}>
      <View style={cardStyles.titleBar} />
      <View style={cardStyles.subtitleBar} />
    </Animated.View>
  );
}

export function SkeletonLoader({ count = 3 }: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cardStyles = useMemo(() => createCardStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} cardStyles={cardStyles} />
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.md,
    },
  });

const createCardStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.skeleton,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      height: 72,
      justifyContent: "center",
    },
    titleBar: {
      height: 14,
      backgroundColor: theme.colors.skeletonHighlight,
      borderRadius: theme.borderRadius.sm,
      width: "70%",
      marginBottom: theme.spacing.sm,
    },
    subtitleBar: {
      height: 10,
      backgroundColor: theme.colors.skeletonHighlight,
      borderRadius: theme.borderRadius.sm,
      width: "40%",
    },
  });
