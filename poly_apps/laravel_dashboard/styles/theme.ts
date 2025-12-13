
// ========== Color System ==========
export const colors = {
  // Primary
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: '#60a5fa',
  primaryDark: '#1e40af',

  // Status
  success: '#10b981',
  successLight: '#34d399',
  successDark: '#059669',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  warningDark: '#d97706',
  error: '#ef4444',
  errorLight: '#f87171',
  errorDark: '#dc2626',
  info: '#3b82f6',
  infoLight: '#60a5fa',
  infoDark: '#2563eb',

  // Neutral (Dark Mode)
  background: '#0f172a',
  surface: '#1e293b',
  surfaceElevated: '#334155',
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: 'rgba(255, 255, 255, 0.05)',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',

  // Neutral (Light Mode)
  backgroundLight: '#f8fafc',
  surfaceLight: '#ffffff',
  surfaceElevatedLight: '#f1f5f9',
  borderLight: '#e2e8f0',
  borderLightLight: '#f1f5f9',
  textLight: '#1e293b',
  textMutedLight: '#64748b',
  textDimLight: '#94a3b8',
};

// ========== Spacing System ==========
export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
};

// ========== Typography System ==========
export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'Monaco, Menlo, "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    md: '1rem',       // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ========== Border Radius ==========
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',
};

// ========== Shadows ==========
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  none: 'none',
};

// ========== Transitions ==========
export const transitions = {
  fast: '150ms ease-in-out',
  normal: '200ms ease-in-out',
  slow: '300ms ease-in-out',
  slower: '500ms ease-in-out',
};

// ========== Z-Index ==========
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
};

// ========== Breakpoints ==========
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// ========== Utility Functions ==========
export const getThemeColor = (color: keyof typeof colors, isDark: boolean = false): string => {
  if (isDark) {
    return colors[color] || colors.text;
  }
  const lightKey = `${color}Light` as keyof typeof colors;
  return colors[lightKey] || colors[color] || colors.textLight;
};

export const getSpacing = (size: keyof typeof spacing): string => {
  return spacing[size];
};

export const getFontSize = (size: keyof typeof typography.fontSize): string => {
  return typography.fontSize[size];
};

// ========== Common Class Names ==========
export const commonClasses = {
  card: 'bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm',
  cardHover: 'hover:shadow-md transition-shadow duration-200',
  button: 'px-4 py-2 rounded-lg font-medium transition-all duration-200',
  buttonPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  buttonSecondary: 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200',
  input: 'px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500',
  badge: 'px-2 py-1 rounded-full text-xs font-medium',
  badgeSuccess: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  badgeWarning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  badgeError: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  badgeInfo: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

