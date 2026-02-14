import React from "react";
import {
  ViewStyle,
  StyleProp,
  Pressable,
  PressableProps,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  delayLongPress,
  style,
  disabled,
  children,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  // Flatten on the JS thread — not available in worklets
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const consumerTransforms = Array.isArray(flat?.transform)
    ? flat.transform
    : [];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, ...consumerTransforms],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  // Strip transform from consumer style to avoid duplication —
  // transforms are already merged inside animatedStyle.
  const baseStyle = React.useMemo(() => {
    if (!flat?.transform) return style;
    const { transform: _t, ...rest } = flat;
    return rest as ViewStyle;
  }, [style, flat]);

  return (
    <ReanimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[baseStyle, animatedStyle]}
      {...rest}
    >
      {children}
    </ReanimatedPressable>
  );
}
