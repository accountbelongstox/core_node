/**
 * Unified shell — shared contracts.
 *
 * This single front-end ("nexus-dash" dashboard, upgraded to a shell) hosts three
 * ends, each with its own prefixed API library, theme, and pages:
 *   - laravel-manager  (Lm*)  manages the Laravel app  -> Nexus theme
 *   - pycore-manager   (Pc*)  manages the pycore service -> Pycore theme
 *   - wordnew          (WfNew*) manages the WordNew client -> Iris theme
 * The home route is a cross-end summary. Files/components carry the end prefix so
 * the architecture (which end a file implements) is visible in its name.
 */

import type { AiChatMessage as CoreAiChatMessage } from '../core/contracts/ai';

export type EndId = 'home' | 'laravel-manager' | 'pycore-manager' | 'wordnew' | 'vortex';

export type ThemeId = 'nexus' | 'pycore' | 'iris';

/** Default theme applied automatically when an end is active (user can override). */
export const END_THEME: Record<EndId, ThemeId> = {
  'home': 'nexus',
  'laravel-manager': 'nexus',
  'pycore-manager': 'pycore',
  'wordnew': 'iris',
  'vortex': 'pycore',
};

export const END_META: Record<Exclude<EndId, 'home'>, { label: string; path: string; theme: ThemeId }> = {
  'laravel-manager': { label: 'Laravel Manager', path: '/laravel-manager', theme: 'nexus' },
  'pycore-manager': { label: 'Pycore Manager', path: '/pycore-manager', theme: 'pycore' },
  'wordnew': { label: 'WordNew', path: '/wordnew', theme: 'iris' },
  'vortex': { label: 'Vortex Sandbox', path: '/vortex', theme: 'pycore' },
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
  // 'pdd-manager': false, // Archived: admin console talks only to laravel_main :9000, no pycore bus.
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

export interface AiChatMessage extends CoreAiChatMessage {
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
