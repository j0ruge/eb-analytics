# Theme API Contract

> This feature has no REST/GraphQL endpoints. This contract defines the **internal TypeScript API** for the theme system that all screens and components consume.

## ThemeProvider

```typescript
// src/theme/ThemeProvider.tsx

interface ThemeContextValue {
  theme: Theme;                              // Active theme (light or dark tokens)
  colorScheme: 'light' | 'dark';            // Resolved color scheme
  themePreference: ThemePreference;          // User's stored preference
  setThemePreference: (pref: ThemePreference) => void; // Update preference
}

type ThemePreference = 'light' | 'dark' | 'system';

// Usage: wrap root layout
<ThemeProvider>{children}</ThemeProvider>
```

## Theme Object

```typescript
// src/theme/index.ts

interface Theme {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
  shadows: ShadowTokens;
}

interface ColorTokens {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  success: string;
  danger: string;
  warning: string;
  info: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  skeleton: string;
  skeletonHighlight: string;
  overlay: string;
}

interface TypographyTokens {
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  body: TextStyle;
  bodySmall: TextStyle;
  caption: TextStyle;
  label: TextStyle;
}

interface SpacingTokens {
  xs: number;  // 4
  sm: number;  // 8
  md: number;  // 16
  lg: number;  // 24
  xl: number;  // 32
  xxl: number; // 48
}

interface BorderRadiusTokens {
  sm: number;   // 4
  md: number;   // 8
  lg: number;   // 12
  xl: number;   // 16
  pill: number; // 20
  full: number; // 9999
}

interface ShadowTokens {
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
  xl: ViewStyle;
}
```

## Hooks

```typescript
// src/hooks/useTheme.ts
function useTheme(): Theme;

// src/hooks/useThemePreference.ts
function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  isLoading: boolean;
};
```

## Component Contracts

```typescript
// src/components/EmptyState.tsx
interface EmptyStateProps {
  icon: string;           // Ionicons name
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// src/components/FAB.tsx
interface FABProps {
  icon?: string;          // Ionicons name, default: "add"
  onPress: () => void;
  label?: string;
}

// src/components/SkeletonLoader.tsx
interface SkeletonLoaderProps {
  width?: number | string;  // default: "100%"
  height: number;
  borderRadius?: number;
  count?: number;           // default: 1
}

// src/components/ErrorRetry.tsx
interface ErrorRetryProps {
  message?: string;         // default: "Algo deu errado. Tente novamente."
  onRetry: () => void;
}
```
