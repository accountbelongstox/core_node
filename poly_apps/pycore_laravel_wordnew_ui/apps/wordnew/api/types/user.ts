/** types/user.ts - auth / profile / preferences / avatar types. (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
/**
 * Authenticated user as returned by the AppQyV1 /login and /register endpoints
 * (backend-aligned snake_case fields). Every field optional so a partial backend
 * payload — or the mock — is always assignable.
 */
export interface WfNewAuthUser {
  id?: string;
  username?: string;
  nickname?: string;
  name?: string;
  email?: string;
  avatar?: string;
  avatar_url?: string;
  native_language?: string;
  learning_languages?: string[];
  member_type?: string;
  bio?: string;
}

/** Normalized result of a successful login/register. */
export interface WfNewAuthResult {
  /** Sanctum Bearer token (backend data.login_token). */
  token: string;
  user: WfNewAuthUser;
}

/**
 * Roaming account preferences (AppQyV1ProfileController get/updatePreferences).
 * `theme` is backend-constrained to 'light' | 'dark'; the wordnew custom theme id
 * and any other client settings live in the opaque `app_settings` blob.
 */
export interface WfNewPreferences {
  theme?: 'light' | 'dark' | string;
  language?: string;
  daily_goal?: number;
  /** Opaque client settings blob (wordnew stores `{ themeId, ... }` here). */
  app_settings?: Record<string, any> | null;
  favorites?: any[];
  recentTools?: any[];
}

/**
 * Registration form payload. `username` + `password` are required; everything
 * else is optional and mirrors the backend's accepted fields (the AppQyV1
 * registration controller validates `learning_languages` / `native_language`
 * against the supported-language catalog).
 */
export interface WfNewRegisterPayload {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
  native_language?: string;
  learning_languages?: string[];
  bio?: string;
  /** Emoji avatar chosen in the form (UI-only; the backend ignores it). */
  avatar?: string;
  invite_code?: string;
}

/**
 * A social-login credential acquired by CapSocialAuth (Google / GitHub). The
 * frontend NEVER logs itself in — it sends this `code` to the backend, which
 * exchanges it with the server-side client secret, verifies the provider profile,
 * finds-or-creates the user, and returns a real WfNewAuthResult. Structurally a
 * subset of shared/capabilities CapSocialCredential.
 */
export interface WfNewSocialCredential {
  provider: 'google' | 'github';
  /** OAuth authorization code (normal path). */
  code?: string;
  /** Google One-Tap ID token (optional path). */
  idToken?: string;
  /** The exact redirect URI used (backend must reuse it on exchange). */
  redirectUri: string;
  /** CSRF state echoed back. */
  state?: string;
  /** PKCE verifier (native code flow). */
  codeVerifier?: string;
}

/** Editable profile fields (POST /user/profile + verification helpers). */
export interface WfNewProfileUpdate {
  nickname?: string;
  name?: string;
  /** Personal description (maps to users.bio). */
  bio?: string;
  location?: string;
  /** Phone number (login identifier; verified separately via SMS). */
  phone?: string;
  email?: string;
}

// ---- Languages & avatars --------------------------------------------------

/** Result of an avatar upload (AppQyV1ProfileController::uploadAvatar). */
export interface WfNewAvatarResult {
  /** Stored relative path (e.g. 'avatars/appqyv1/avatar_1_123.png'). */
  avatar: string;
  /** Absolute URL for rendering. */
  avatar_url: string;
}

// ---- Social ---------------------------------------------------------------
// Backend-aligned shapes (AppQyV1SocialController). Every list endpoint wraps its
// rows under `data.{friends|users|leaderboard|activities}`.

/** Per-user learning counters attached to social rows (statsRowFor). */
export interface WfNewSocialStats {
  learned?: number;
  mastered?: number;
  streak?: number;
  [k: string]: any;
}
