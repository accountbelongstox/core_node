import { StyleSheet } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  
  // Background colors
  background: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textDisabled: string;
  
  // Border and divider
  border: string;
  divider: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Overlay
  overlay: string;
  
  // Special effects
  holoWhite: string;
  glassBackground: string;
  blurBackground: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
}

const lightColors: ThemeColors = {
  primary: '#2196F3',
  primaryLight: '#64B5F6',
  primaryDark: '#1976D2',
  
  background: '#FFFFFF',
  surface: '#F5F5F5',
  card: '#FFFFFF',
  
  text: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',
  
  border: '#E0E0E0',
  divider: '#E0E0E0',
  
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  overlay: 'rgba(0, 0, 0, 0.5)',
  
  holoWhite: 'rgba(255, 255, 255, 0.95)',
  glassBackground: 'rgba(255, 255, 255, 0.8)',
  blurBackground: 'rgba(255, 255, 255, 0.7)',
};

const darkColors: ThemeColors = {
  primary: '#64B5F6',
  primaryLight: '#90CAF9',
  primaryDark: '#42A5F5',
  
  background: '#121212',
  surface: '#1E1E1E',
  card: '#2C2C2C',
  
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textDisabled: '#616161',
  
  border: '#424242',
  divider: '#424242',
  
  success: '#66BB6A',
  warning: '#FFA726',
  error: '#EF5350',
  info: '#42A5F5',
  
  overlay: 'rgba(0, 0, 0, 0.7)',
  
  holoWhite: 'rgba(255, 255, 255, 0.1)',
  glassBackground: 'rgba(30, 30, 30, 0.8)',
  blurBackground: 'rgba(18, 18, 18, 0.7)',
};

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
};

export const getTheme = (mode: ThemeMode): Theme => {
  return mode === 'light' ? lightTheme : darkTheme;
};

// Common styles
export const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      margin: 8,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    text: {
      color: theme.colors.text,
    },
    textSecondary: {
      color: theme.colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.divider,
    },
  });
};

