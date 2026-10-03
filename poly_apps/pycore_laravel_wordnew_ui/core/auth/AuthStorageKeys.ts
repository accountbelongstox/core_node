export const AuthStorageKeys = {
  /** Pre-namespace single-token key; adopted once into the first active namespace, then removed. */
  TOKEN: 'app_auth_token',
  SESSIONS: 'app_auth_sessions',
} as const;
