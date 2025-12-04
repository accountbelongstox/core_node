import { ThemeMode } from '@/apps/awy/awy_types';

export interface ThemeColors {
  // Primary Colors
  primary: string;
  primaryGradient: string[];
  danger: string;
  dangerGradient: string[];
  
  // Background & Text
  bg: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  
  // Navigation Colors
  navBg: string;
  navText: string;
  navActive: string;
  navShadow: string;
  
  // Glassmorphism Colors
  glassBg: string;
  glassBorder: string;
  glassShadow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  
  // Input Colors
  inputBg: string;
  
  // Border Radius
  cardRadius: number;
  btnRadius: number;
}

export const lightTheme: ThemeColors = {
  // Primary Colors
  primary: '#3b82f6',
  primaryGradient: ['#3b82f6', '#06b6d4'],
  danger: '#ef4444',
  dangerGradient: ['#ef4444', '#ec4899'],
  
  // Background & Text
  bg: '#f0f4f8',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textInverse: '#ffffff',
  
  // Navigation Colors
  navBg: '#ffffff',
  navText: '#64748b',
  navActive: '#3b82f6', // Blue primary color for light mode
  navShadow: 'rgba(0, 0, 0, 0.15)',
  
  // Glassmorphism Colors - Light Mode
  glassBg: 'rgba(255, 255, 255, 0.4)',
  glassBorder: 'rgba(255, 255, 255, 0.6)',
  glassShadow: {
    shadowColor: 'rgba(31, 38, 135, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 4,
  },
  
  // Input Colors
  inputBg: 'rgba(255, 255, 255, 0.5)',
  
  // Border Radius
  cardRadius: 16,
  btnRadius: 12,
};

export const darkTheme: ThemeColors = {
  // Primary Colors
  primary: '#3b82f6',
  primaryGradient: ['#3b82f6', '#06b6d4'],
  danger: '#ef4444',
  dangerGradient: ['#ef4444', '#ec4899'],
  
  // Background & Text
  bg: '#0f172a',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textInverse: '#ffffff',
  
  // Navigation Colors
  navBg: '#1e293b',
  navText: '#94a3b8',
  navActive: '#60a5fa', // Lighter blue for dark mode
  navShadow: 'rgba(0, 0, 0, 0.5)',
  
  // Glassmorphism Colors - Dark Mode
  glassBg: 'rgba(15, 23, 42, 0.6)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassShadow: {
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 4,
  },
  
  // Input Colors
  inputBg: 'rgba(0, 0, 0, 0.2)',
  
  // Border Radius
  cardRadius: 16,
  btnRadius: 12,
};

export const getTheme = (mode: ThemeMode): ThemeColors => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

