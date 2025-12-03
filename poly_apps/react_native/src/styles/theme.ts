import { ThemeMode } from '../types';

export interface ThemeColors {
  primary: string;
  primaryGradient: string[];
  danger: string;
  dangerGradient: string[];
  bg: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  navBg: string;
  navText: string;
  navActive: string;
  glassBg: string;
  glassBorder: string;
  inputBg: string;
  cardRadius: number;
  btnRadius: number;
}

export const lightTheme: ThemeColors = {
  primary: '#3b82f6',
  primaryGradient: ['#3b82f6', '#06b6d4'],
  danger: '#ef4444',
  dangerGradient: ['#ef4444', '#ec4899'],
  bg: '#f0f4f8',
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textInverse: '#ffffff',
  navBg: '#ffffff',
  navText: '#64748b',
  navActive: '#14b8a6',
  glassBg: 'rgba(255, 255, 255, 0.4)',
  glassBorder: 'rgba(255, 255, 255, 0.6)',
  inputBg: 'rgba(255, 255, 255, 0.5)',
  cardRadius: 16,
  btnRadius: 12,
};

export const darkTheme: ThemeColors = {
  primary: '#3b82f6',
  primaryGradient: ['#3b82f6', '#06b6d4'],
  danger: '#ef4444',
  dangerGradient: ['#ef4444', '#ec4899'],
  bg: '#0f172a',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textInverse: '#ffffff',
  navBg: '#1e293b',
  navText: '#94a3b8',
  navActive: '#2dd4bf',
  glassBg: 'rgba(15, 23, 42, 0.6)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  inputBg: 'rgba(0, 0, 0, 0.2)',
  cardRadius: 16,
  btnRadius: 12,
};

export const getTheme = (mode: ThemeMode): ThemeColors => {
  return mode === 'dark' ? darkTheme : lightTheme;
};

