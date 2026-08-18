/**
 * View ↔ URL routing primitive.
 *
 * The dashboard is a single-page app served behind Laravel; we don't want to
 * depend on a server-side rewrite for deep links, so route info lives in the
 * URL HASH (`#/ai-management`) — it works under any host/prefix without needing
 * `try_files` or a Laravel catch-all. The slug map is owned here so every
 * `setActiveView` automatically reflects in the URL via `UnifiedAppContext`,
 * and the browser Back/Forward buttons drive `activeView` via `popstate`.
 *
 * This file has NO side effects on import — `bindViewRouting` must be called
 * once by the context to install the listener.
 */

import { ViewType } from '../uiTypes';

/** ViewType → URL slug. Values are URL-friendly kebab-case. */
export const VIEW_TO_SLUG: Record<ViewType, string> = {
  [ViewType.DASHBOARD]: 'dashboard',
  [ViewType.MEDIA_BROWSER]: 'media',
  [ViewType.TOOLS]: 'tools',
  [ViewType.API_TESTER]: 'api',
  [ViewType.SETTINGS]: 'settings',
  [ViewType.SYSTEM_INFO]: 'system',
  [ViewType.VOCABULARY]: 'vocabulary',
  [ViewType.TASK_CENTER]: 'task-center',
  [ViewType.SERVER_MANAGER]: 'server',
  [ViewType.AI_MANAGEMENT]: 'ai-management',
  [ViewType.WORD_AUDIO]: 'word-audio',
  [ViewType.DATABASE_MANAGER]: 'db-manager',
};

/** Reverse lookup. Computed once so unknown slugs degrade O(1). */
const SLUG_TO_VIEW: Record<string, ViewType> = Object.fromEntries(
  Object.entries(VIEW_TO_SLUG).map(([view, slug]) => [slug, view as ViewType])
) as Record<string, ViewType>;

export function viewToSlug(view: ViewType): string {
  return VIEW_TO_SLUG[view] ?? '';
}

/**
 * Parse a canonical slug into a known ViewType.
 */
export function slugToView(rawSlug: string | null | undefined): ViewType | null {
  if (!rawSlug) return null;
  let s = rawSlug.trim().replace(/^[#/]+/, '');
  const queryIx = s.indexOf('?');
  if (queryIx >= 0) s = s.slice(0, queryIx);
  s = s.replace(/\/+$/, '');
  if (!s) return null;
  return SLUG_TO_VIEW[s] ?? null;
}

/** Read the current ViewType from `window.location.hash`, or null if absent/unknown. */
export function readViewFromHash(): ViewType | null {
  if (typeof window === 'undefined') return null;
  return slugToView(window.location.hash);
}

/**
 * Write a ViewType to the URL hash. Uses `replaceState` on the FIRST write
 * (no synthetic back-button entry for the initial paint) and `pushState` for
 * subsequent navigations so Back/Forward walk the history. No-op if the URL
 * already matches the target slug (prevents the state↔URL feedback loop).
 */
let didFirstWrite = false;
export function writeViewToHash(view: ViewType): void {
  if (typeof window === 'undefined') return;
  const slug = viewToSlug(view);
  if (!slug) return;
  const target = `#/${slug}`;
  if (window.location.hash === target) return;
  const url = window.location.pathname + window.location.search + target;
  if (!didFirstWrite) {
    didFirstWrite = true;
    window.history.replaceState(window.history.state, '', url);
  } else {
    window.history.pushState(window.history.state, '', url);
  }
}

/**
 * Install a popstate/hashchange listener that calls `onUrlChange` whenever
 * the URL's hash resolves to a different known view. Returns a teardown
 * function. Pure observer: never writes the URL itself.
 */
export function bindHashListener(onUrlChange: (view: ViewType) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    const next = readViewFromHash();
    if (next !== null) onUrlChange(next);
  };
  window.addEventListener('popstate', handler);
  window.addEventListener('hashchange', handler);
  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener('hashchange', handler);
  };
}
