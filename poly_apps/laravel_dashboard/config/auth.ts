/**
 * Central config for views that require login (auth-gated pages).
 *
 * CURRENT PROTECTED PAGES (需登录才能操作的页面):
 * - Server Manager (SERVER_MANAGER)
 * - Settings (SETTINGS)
 * - Invite Code Manager (INVITE_CODE_MANAGER)
 * - Database Viewer (DATABASE_VIEWER)
 *
 * DESIGN RATIONALE (后续沿用此风格):
 * - Single source of truth: all "must be logged in" views are listed here.
 * - Used by App.tsx to wrap content with AuthGuard and by any code that needs to
 *   know if a view is protected (e.g. analytics, routing).
 * - Login modal is shown only over the right (main) area, not full screen; sidebar stays visible so user can navigate away.
 * - Message copy is kept in TRANSLATIONS (constants.tsx); this module uses i18n.t(key, { lng })
 *   so no language branching and no direct TRANSLATIONS access.
 *
 * When adding a new protected page:
 * 1. Add its ViewType to REQUIRE_LOGIN_VIEWS below.
 * 2. Add the corresponding auth_required message in constants.tsx (en + zh) under
 *    the appropriate key (e.g. server_manager, db_viewer).
 * 3. Add the message key to VIEW_AUTH_MESSAGE_KEYS below.
 * 4. App.tsx will automatically wrap that view with AuthGuard and open login modal when not logged in.
 */

import { ViewType } from '../types';
import type { Language } from '../types';
import i18n from '../core/i18n';

/** All view types that require the user to be logged in. No prompt, no content until authenticated. */
export const REQUIRE_LOGIN_VIEWS: ViewType[] = [
  ViewType.SERVER_MANAGER,
  ViewType.SETTINGS,
  ViewType.INVITE_CODE_MANAGER,
  ViewType.DATABASE_VIEWER
];

/** Map ViewType -> key path in TRANSLATIONS[lang] for auth_required message (e.g. server_manager.auth_required). Only entries for REQUIRE_LOGIN_VIEWS. */
const VIEW_AUTH_MESSAGE_KEYS: Partial<Record<ViewType, string>> = {
  [ViewType.SERVER_MANAGER]: 'server_manager.auth_required',
  [ViewType.SETTINGS]: 'settings.auth_required',
  [ViewType.INVITE_CODE_MANAGER]: 'invite_codes.auth_required',
  [ViewType.DATABASE_VIEWER]: 'db_viewer.auth_required'
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
