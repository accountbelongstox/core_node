/**
 * Unified shell — shared contracts.
 *
 * This single front-end ("nexus-dash" dashboard, upgraded to a shell) hosts three
 * ends, each with its own prefixed API library, theme, and pages:
 *   - laravel-manager  (Lm*)  manages the Laravel app  -> Nexus theme
 *   - pycore-manager   (Pc*)  manages the pycore service -> Pycore theme
 *   - wordflow         (Wf*)  the WordFlow word client   -> Iris theme
 * The home route is a cross-end summary. Files/components carry the end prefix so
 * the architecture (which end a file implements) is visible in its name.
 */

export type EndId = 'home' | 'laravel-manager' | 'pycore-manager' | 'wordflow';

export type ThemeId = 'nexus' | 'pycore' | 'iris';

/** Default theme applied automatically when an end is active (user can override). */
export const END_THEME: Record<EndId, ThemeId> = {
  'home': 'nexus',
  'laravel-manager': 'nexus',
  'pycore-manager': 'pycore',
  'wordflow': 'iris',
};

export const END_META: Record<Exclude<EndId, 'home'>, { label: string; path: string; theme: ThemeId }> = {
  'laravel-manager': { label: 'Laravel Manager', path: '/laravel-manager', theme: 'nexus' },
  'pycore-manager': { label: 'Pycore Manager', path: '/pycore-manager', theme: 'pycore' },
  'wordflow': { label: 'WordFlow', path: '/wordflow', theme: 'iris' },
};

/** Languages supported across the union of the three ends. */
export const SHELL_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

// ---- AI ChatKit contract (shared chat framework, one per end via adapters) ----

export interface AiChatMessageMeta {
  provider?: string;
  model?: string;
  /** Display label, e.g. huggingface/meta-llama/Llama-3.1-8B-Instruct */
  nickname?: string;
  latency_ms?: number | null;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  meta?: AiChatMessageMeta;
}

export interface AiChatSendResult {
  text: string;
  meta?: AiChatMessageMeta;
}

export interface AiChatProvider {
  id: string;
  label: string;
  models?: string[];
  /** Live probe succeeded — false still allows manual retry when configured. */
  available?: boolean;
  probeError?: string | null;
}

export interface AiChatSendOptions {
  provider?: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * A chat adapter binds the shared AiChatKit UI to one end's existing chat backend.
 * `send` returns the assistant reply text; `listProviders` is optional (pycore
 * exposes a multi-provider probe, others may be single-provider).
 */
export interface AiChatAdapter {
  id: string;
  label: string;
  listProviders?: () => Promise<AiChatProvider[]>;
  send: (messages: AiChatMessage[], opts: AiChatSendOptions) => Promise<AiChatSendResult>;
}

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
}
