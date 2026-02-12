export interface ColorTokens {
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

export const lightColors: ColorTokens = {
  primary: '#007AFF',
  primaryLight: '#E5F0FF',
  background: '#FFFFFF',
  surface: '#F2F2F7',
  surfaceElevated: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  border: '#C6C6C8',
  borderLight: '#E5E5EA',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  info: '#5856D6',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#C6C6C8',
  tabBarActive: '#007AFF',
  tabBarInactive: '#8E8E93',
  skeleton: '#E5E5EA',
  skeletonHighlight: '#F2F2F7',
  overlay: 'rgba(0,0,0,0.4)',
};

export const darkColors: ColorTokens = {
  primary: '#0A84FF',
  primaryLight: '#0A3D6B',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#98989D',
  textTertiary: '#48484A',
  border: '#38383A',
  borderLight: '#2C2C2E',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
  info: '#5E5CE6',
  tabBarBackground: '#1C1C1E',
  tabBarBorder: '#38383A',
  tabBarActive: '#0A84FF',
  tabBarInactive: '#636366',
  skeleton: '#2C2C2E',
  skeletonHighlight: '#3A3A3C',
  overlay: 'rgba(0,0,0,0.6)',
};
