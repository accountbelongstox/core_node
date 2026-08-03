/**
 * Central config for views that require login (auth-gated pages).
 *
 * CURRENT PROTECTED PAGES (pages that require login to operate):
 * - Server Manager (SERVER_MANAGER)
 * - Settings (SETTINGS)
 * - Database Manager (DATABASE_MANAGER) — absorbed the former Database Viewer
 *
 * NOTE: a loopback DEBUG bypass (setDebugAuthBypass / isDebugAuthBypass) can
 * globally treat the user as authenticated; see below.
 *
 * DESIGN RATIONALE (keep following this style going forward):
 * - Single source of truth: all "must be logged in" views are listed here.
 * - Used by App.tsx to wrap content with AuthGuard and by any code that needs to
 *   know if a view is protected (e.g. analytics, routing).
 * - Protected views remain mounted while the application shell shows the shared login modal.
 * - Message copy is kept in TRANSLATIONS (constants.tsx); this module uses i18n.t(key, { lng })
 *   so no language branching and no direct TRANSLATIONS access.
 *
 * When adding a new protected page:
 * 1. Add its ViewType to REQUIRE_LOGIN_VIEWS below.
 * 2. Add the corresponding auth_required message in constants.tsx (en + zh) under
 *    the appropriate key (e.g. server_manager, db_manager).
 * 3. Add the message key to VIEW_AUTH_MESSAGE_KEYS below.
 * 4. App.tsx will automatically wrap that view with AuthGuard and open login modal when not logged in.
 */

import { ViewType } from '../apps/laravel-manager/uiTypes';
import type { Language } from '../apps/laravel-manager/uiTypes';
import i18n from '../apps/laravel-manager/i18n';

/** All view types that require the user to be logged in for protected operations. */
export const REQUIRE_LOGIN_VIEWS: ViewType[] = [
  ViewType.SERVER_MANAGER,
  ViewType.SETTINGS,
  ViewType.DATABASE_MANAGER
];

/**
 * Loopback DEBUG auth-bypass flag.
 *
 * When the backend reports `debug_mode: true` from GET /api/dashboard/auth/debug-status
 * (i.e. the request originates from loopback / 127.0.0.1), the whole dashboard
 * treats the user as authenticated: AuthGuard renders protected views directly
 * and never opens the login modal. When false (remote / disabled), behavior is
 * unchanged — protected views still require a real login.
 *
 * This is a single source of truth alongside REQUIRE_LOGIN_VIEWS. App startup
 * probes the debug status once and calls setDebugAuthBypass(); AuthGuard reads
 * it via isDebugAuthBypass(). Kept as a module flag (not React state) so it is
 * available synchronously to AuthGuard without threading new props/context.
 */
let debugAuthBypass = false;

/** Set by app startup after probing GET /auth/debug-status. */
export function setDebugAuthBypass(enabled: boolean): void {
  debugAuthBypass = enabled === true;
}

/** True when the loopback debug bypass is active (treat all users as authed). */
export function isDebugAuthBypass(): boolean {
  return debugAuthBypass;
}

/** Map ViewType -> key path in TRANSLATIONS[lang] for auth_required message (e.g. server_manager.auth_required). Only entries for REQUIRE_LOGIN_VIEWS. */
const VIEW_AUTH_MESSAGE_KEYS: Partial<Record<ViewType, string>> = {
  [ViewType.SERVER_MANAGER]: 'server_manager.auth_required',
  [ViewType.SETTINGS]: 'settings.auth_required',
  [ViewType.DATABASE_MANAGER]: 'db_manager.auth_required'
};

/** Returns the localized "auth required" message for a protected view. Uses central i18n (no language branching). */
export function getRequireLoginMessage(viewType: ViewType, lng: Language): string {
  const key = VIEW_AUTH_MESSAGE_KEYS[viewType];
  if (!key) return i18n.t('auth.login_hint', { lng });
  const msg = i18n.t(key, { lng });
  return typeof msg === 'string' && msg !== key ? msg : i18n.t('auth.login_hint', { lng });
}

/** Check if a view is protected (requires login). */
export function isRequireLoginView(viewType: ViewType): boolean {
  return REQUIRE_LOGIN_VIEWS.includes(viewType);
}
