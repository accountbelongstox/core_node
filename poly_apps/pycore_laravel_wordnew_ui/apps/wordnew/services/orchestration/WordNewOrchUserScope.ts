import { wfNewSettings } from '../../WfNewSettingsStore';

const ORCH_USER_ROOT = 'wfnew-orch/users';
const GUEST_SCOPE = 'guest';
const SCOPE_MAX = 64;

/** The signed-in user's storage scope (the login's user id; `guest` while signed out). */
export function orchUserScope(): string {
  const userId = wfNewSettings.get('isLoggedIn') ? String(wfNewSettings.get('userId') || '') : '';
  return userId.replace(/[^A-Za-z0-9_.@-]/g, '_').slice(0, SCOPE_MAX) || GUEST_SCOPE;
}

/** A file path under the user's orchestration folder. */
export function orchUserPath(scope: string, name: string): string {
  return `${ORCH_USER_ROOT}/${scope}/${name}`;
}
