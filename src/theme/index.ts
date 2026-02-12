import { ColorTokens, lightColors, darkColors } from './colors';
import { TypographyTokens, typography } from './typography';
import { ShadowTokens, shadows } from './shadows';

export interface Theme {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
  shadows: ShadowTokens;
}

export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface BorderRadiusTokens {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
  full: number;
}

const spacing: SpacingTokens = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const borderRadius: BorderRadiusTokens = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 20,
  full: 9999,
};

export const lightTheme: Theme = {
  colors: lightColors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

export const darkTheme: Theme = {
  colors: darkColors,
  typography,
  spacing,
  borderRadius,
  shadows,
};
