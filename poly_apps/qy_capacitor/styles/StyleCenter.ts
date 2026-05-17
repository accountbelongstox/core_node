/**
 * Style Center - Unified Style System
 * Design Tokens: Blur-SM(4px) | Blur-MD(12px) | Blur-LG(24px). Border-Radius 24px, Shadow-Level.
 */

const DesignTokens = {
  glass: { opacity: 0.42, blur: '40px', borderHighlight: 'rgba(255, 255, 255, 0.22)' },
  materialThin: { blur: '12px', opacity: 0.62 },
  materialThick: { blur: '40px', opacity: 0.38 },
  blur: { sm: '4px', md: '12px', lg: '24px', glass: '20px', ultra: '40px' },
  radius: { sm: '8px', md: '16px', card: '24px', button: '24px', full: '9999px' },
  shadow: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
    md: '0 8px 24px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
    float: '0 24px 56px rgba(0, 0, 0, 0.08), 0 8px 16px rgba(0, 0, 0, 0.04)',
  },
  layout: {
    touchMin: 44,
    gridUnit: 8,
    pagePaddingH: 'var(--page-padding-h)',
    pagePaddingV: 'var(--page-padding-v)',
    barGap: 'var(--bar-gap)',
  },
};

export const StyleCenter = {
  tokens: DesignTokens,
  // Colors
  colors: {
    primary: '#3b82f6',      // blue-600
    primaryDark: '#2563eb',  // blue-700
    primaryLight: '#60a5fa', // blue-400

    secondary: '#6366f1',    // indigo-600
    secondaryDark: '#4f46e5',// indigo-700
    secondaryLight: '#818cf8',// indigo-400

    success: '#10b981',      // emerald-500
    warning: '#f59e0b',      // amber-500
    error: '#ef4444',        // red-500
    info: '#3b82f6',         // blue-600

    text: {
      primary: '#1e293b',    // slate-800
      secondary: '#475569',  // slate-600
      tertiary: '#94a3b8',   // slate-400
      disabled: '#cbd5e1',   // slate-300
    },

    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',  // slate-50
      tertiary: '#f1f5f9',   // slate-100
    },

    border: {
      light: '#e2e8f0',      // slate-200
      medium: '#cbd5e1',     // slate-300
      dark: '#94a3b8',       // slate-400
    },

    dark: {
      text: {
        primary: '#f8fafc',    // slate-50
        secondary: '#cbd5e1',  // slate-300
        tertiary: '#94a3b8',   // slate-400
        disabled: '#64748b',   // slate-500
      },
      background: {
        primary: '#0f172a',    // slate-950
        secondary: '#1e293b',  // slate-800
        tertiary: '#334155',   // slate-700
      },
      border: {
        light: '#334155',      // slate-700
        medium: '#475569',     // slate-600
        dark: '#64748b',       // slate-500
      },
    },
  },

  // Typography
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },

    fontSize: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
    },

    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },

    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },

  // Spacing
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // Border radius (align with Design Tokens)
  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    xl: '1.5rem',
    card: DesignTokens.radius.card,
    button: DesignTokens.radius.button,
    '2xl': '2rem',
    full: '9999px',
  },

  // Shadows (Shadow-Level)
  shadows: {
    sm: DesignTokens.shadow.sm,
    md: DesignTokens.shadow.md,
    lg: DesignTokens.shadow.lg,
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    float: DesignTokens.shadow.float,
  },

  // Transitions
  transitions: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    easeLiquid: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeSmooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },

  // Z-index
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },

  // Breakpoints (for reference, actual implementation in CSS)
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Common component styles (base > personalized; use ds-* classes in CSS when possible)
  components: {
    button: {
      base: `
        py-4 px-6 rounded-[var(--radius-button,24px)] font-bold tracking-wide
        transition-all duration-300 active:scale-[0.98]
        flex items-center justify-center gap-2 ds-btn
      `,
      primary: `
        bg-blue-600 text-white
        border border-blue-400/30
        shadow-[0_0_15px_rgba(37,99,235,0.3)]
        hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]
        hover:bg-blue-500
      `,
      secondary: `
        bg-white/10 dark:bg-white/5
        backdrop-blur-[var(--blur-md)]
        text-slate-700 dark:text-white
        hover:bg-white/20
        border border-white/20 dark:border-white/10 ds-glass-edge
      `,
      danger: `
        bg-red-500/10 text-red-500
        border border-red-500/30
        hover:bg-red-500/20
      `,
    },

    card: `
      ds-card rounded-[var(--radius-card,24px)] p-6
      relative overflow-hidden group
    `,

    input: `
      w-full px-4 py-3 rounded-xl glass-input
      border border-white/20 dark:border-white/10
      text-slate-800 dark:text-white
      placeholder:text-slate-400
      focus:outline-none focus:ring-2 focus:ring-blue-500/50
    `,
  },
};

// Utility functions
export const cx = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const getColor = (path: string): string => {
  const keys = path.split('.');
  let value: any = StyleCenter.colors;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return '#000000';
    }
  }

  return typeof value === 'string' ? value : '#000000';
};
