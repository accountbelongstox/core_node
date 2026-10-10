/** Unified shell — shared contracts (end ids, themes, languages). */
import { UI_SUPPORTED_LANGUAGES } from '../core/i18n/UiI18n';

export type EndId = 'home' | 'laravel-manager' | 'pycore-manager' | 'wordnew' | 'vortex' | 'codemart';

export const THEME_IDS = ['nexus', 'pycore', 'iris'] as const;

export type ThemeId = typeof THEME_IDS[number];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export type ShellClipboardTab = 'clipboard' | 'prompts';
export interface ShellClipboardState {
  open: boolean;
  collapsed: boolean;
  expanded: boolean;
  namespace: string;
  /** Active panel tab: the cloud clipboard itself or the AI-derived prompt feed. */
  tab: ShellClipboardTab;
}

/** Default theme applied automatically when an end is active (user can override). */
export const END_THEME: Record<EndId, ThemeId> = {
  'home': 'nexus',
  'laravel-manager': 'nexus',
  'pycore-manager': 'pycore',
  'wordnew': 'iris',
  'vortex': 'pycore',
  'codemart': 'nexus',
};

export const END_META: Record<Exclude<EndId, 'home'>, { label: string; path: string; theme: ThemeId }> = {
  'laravel-manager': { label: 'Laravel Manager', path: '/laravel-manager', theme: 'nexus' },
  'pycore-manager': { label: 'Pycore Manager', path: '/pycore-manager', theme: 'pycore' },
  'wordnew': { label: 'WordNew', path: '/wordnew', theme: 'iris' },
  'vortex': { label: 'Vortex Sandbox', path: '/vortex', theme: 'pycore' },
  'codemart': { label: 'CodeMart', path: '/codemart', theme: 'nexus' },
};

/**
 * Per-app live-service gate for the pycore HTTP event transport on :59000.
 * CONNECTED. Every other end SUSPENDS it — the connection is closed and stops
 * reconnecting, but its state (client id, resume token, subscribe() handlers,
 * started intent) is preserved and resumes when a pycore end becomes active
 * again. The shell applies this on every route change (ShellContext) via
 * setPycoreActive(). Background services run
 * ONLY under their owning route; everything else is paused, not torn down.
 */
export const END_USES_PYCORE: Record<EndId, boolean> = {
  'home': false,
  'laravel-manager': false,
  'pycore-manager': true,
  'wordnew': false,   // pycore bus connects ONLY under pycore routes (paused, state kept)
  'vortex': true,      // OKX panels drive the pycore RPC bus
  'codemart': false,
};

/** Language labels keyed by code; apps filter this catalog to their own supported set. */
export const SHELL_LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

/** Shell switcher languages: exactly the codes i18next has translations for. */
export const SHELL_LANGUAGES: { code: string; label: string }[] = UI_SUPPORTED_LANGUAGES.map(
  (code) => ({ code, label: SHELL_LANGUAGE_LABELS[code] ?? code }),
);

export interface ShellContextValue {
  end: EndId;
  themeId: ThemeId;
  themeOverride: ThemeId | null;
  setThemeOverride: (t: ThemeId | null) => void;
  dark: boolean;
  toggleDark: () => void;
  setDark: (v: boolean) => void;
  lang: string;
  setLang: (code: string) => void;
  chatOpen: boolean;
  activeChatAdapterId: string;
  openChat: (adapterId?: string) => void;
  closeChat: () => void;
  clipboard: ShellClipboardState;
  setClipboard: (update: Partial<ShellClipboardState>) => void;
  toggleClipboard: () => void;
}
