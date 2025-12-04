// Style Utility Functions - Reusable style logic
import { theme } from './theme';

export const styles = {
  // Background utilities
  bg: {
    void: { backgroundColor: theme.colors.bg.void },
    panel: { backgroundColor: theme.colors.bg.panel },
    panelTransparent: { backgroundColor: theme.colors.bg.panelTransparent },
    black: { backgroundColor: theme.colors.bg.black },
  },
  // Text color utilities
  text: {
    main: { color: theme.colors.text.main },
    muted: { color: theme.colors.text.muted },
    dim: { color: theme.colors.text.dim },
    cyan: { color: theme.colors.primary.cyan },
    purple: { color: theme.colors.primary.purple },
    success: { color: theme.colors.status.success },
    alert: { color: theme.colors.status.alert },
  },
  // Border utilities
  border: {
    default: { borderColor: theme.colors.border.default },
    highlight: { borderColor: theme.colors.border.highlight },
    light: { borderColor: theme.colors.border.light },
  },
  // Glass effect
  glass: {
    background: theme.colors.glass.bg,
    backdropFilter: theme.colors.glass.backdrop,
    WebkitBackdropFilter: theme.colors.glass.backdrop,
    border: theme.colors.glass.border,
  },
};

// Tailwind class helpers (for use with className)
export const tw = {
  bg: {
    void: 'bg-[var(--bg-void)]',
    panel: 'bg-[var(--bg-panel)]',
    black: 'bg-[var(--bg-black)]',
  },
  text: {
    main: 'text-white',
    muted: 'text-slate-400',
    cyan: 'text-[var(--cyan)]',
    purple: 'text-[var(--purple)]',
    success: 'text-[var(--success)]',
    alert: 'text-[var(--alert)]',
  },
  border: {
    default: 'border-white/10',
    highlight: 'border-white/20',
    light: 'border-white/5',
  },
};

