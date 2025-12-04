// Unified Theme System - No hardcoded styles
export const theme = {
  colors: {
    bg: {
      void: '#030305',
      panel: 'rgba(10, 12, 16, 0.85)',
      panelTransparent: 'rgba(10, 12, 16, 0.75)',
      black: '#0a0c10',
      blackLight: '#0d0f14',
    },
    primary: {
      cyan: '#00f2ff',
      cyanDim: 'rgba(0, 242, 255, 0.15)',
      cyanLight: 'rgba(0, 242, 255, 0.2)',
      purple: '#bd00ff',
      purpleDim: 'rgba(189, 0, 255, 0.15)',
    },
    status: {
      alert: '#ff2a6d',
      success: '#05ffa1',
      warning: '#ffaa00',
    },
    text: {
      main: '#ffffff',
      muted: 'rgba(255, 255, 255, 0.55)',
      dim: 'rgba(255, 255, 255, 0.3)',
      slate: {
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
      },
    },
    border: {
      default: 'rgba(255, 255, 255, 0.08)',
      highlight: 'rgba(255, 255, 255, 0.2)',
      light: 'rgba(255, 255, 255, 0.1)',
    },
    glass: {
      bg: 'rgba(10, 12, 16, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backdrop: 'blur(20px)',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  layout: {
    headerHeight: '60px',
    sidebarWidth: '240px',
    sidebarWidthCollapsed: '60px',
    inspectorWidth: '300px',
    inspectorWidthCollapsed: '60px',
  },
  typography: {
    fontFamily: {
      ui: "'Inter', sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    fontSize: {
      xs: '0.625rem',
      sm: '0.75rem',
      base: '0.875rem',
      lg: '1rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
    },
  },
  effects: {
    shadow: {
      cyan: '0 0 15px rgba(0, 242, 255, 0.3)',
      purple: '0 0 10px rgba(189, 0, 255, 0.5)',
      success: '0 0 10px rgba(5, 255, 161, 0.5)',
      glow: '0 0 20px rgba(0, 242, 255, 0.2)',
    },
    backdrop: 'blur(20px)',
  },
  animations: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
  },
} as const;

// CSS Class Utilities
export const cn = {
  glass: 'glass-panel',
  text: {
    main: 'text-white',
    muted: 'text-slate-400',
    dim: 'text-slate-500',
    cyan: 'text-[#00f2ff]',
    purple: 'text-[#bd00ff]',
    success: 'text-[#05ffa1]',
    alert: 'text-[#ff2a6d]',
  },
  bg: {
    void: 'bg-[#030305]',
    panel: 'bg-[#0a0c10]',
    glass: 'bg-[#0a0c10]/95',
  },
  border: {
    default: 'border-white/10',
    light: 'border-white/5',
    highlight: 'border-white/20',
  },
} as const;

