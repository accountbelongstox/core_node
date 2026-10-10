import { registerLocalDataGroup } from '../persistence/LocalDataRegistry';

export const AuthStorageKeys = {
  /** Pre-namespace single-token key; adopted once into the first active namespace, then removed. */
  TOKEN: 'app_auth_token',
  SESSIONS: 'app_auth_sessions',
} as const;

registerLocalDataGroup({
  id: 'core.auth_session',
  appId: 'core',
  labelKey: 'common.local_data.groups.auth_session',
  descriptionKey: 'common.local_data.groups.auth_session_desc',
  clearable: false,
  sources: [{ kind: 'localStorage', keys: Object.values(AuthStorageKeys) }],
});
