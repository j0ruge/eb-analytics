import { Platform, ViewStyle } from 'react-native';

export interface ShadowTokens {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
  xl: ViewStyle;
}

function createShadow(
  offsetY: number,
  radius: number,
  opacity: number,
  elevation: number
): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: {
      elevation,
    },
    default: {
      elevation,
    },
  }) as ViewStyle;
}

export const shadows: ShadowTokens = {
  sm: createShadow(1, 2, 0.1, 2),
  md: createShadow(2, 4, 0.15, 4),
  lg: createShadow(4, 8, 0.2, 8),
  xl: createShadow(8, 16, 0.25, 16),
};
