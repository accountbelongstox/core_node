/* =============================================================================
 * CapSocialAuth — public, cross-platform SOCIAL LOGIN (Google + GitHub) library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library, *built primarily for the wordnew mobile APP*.
 *   One-click "Sign in with Google" / "Sign in with GitHub" for the login /
 *   register screens, plus account BINDING (link/unlink a provider) from the
 *   profile/settings page. Native (Capacitor) + web fallback.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  WHERE TO GET THE KEYS  (申请 KEY 的地方 — read this before it will work)
 * ──────────────────────────────────────────────────────────────────────────
 *  GOOGLE (一键登录):
 *    1. https://console.cloud.google.com  →  create / pick a project.
 *    2. "APIs & Services" → "OAuth consent screen": configure app name, support
 *       email, scopes (openid, email, profile), and (for production) verify.
 *    3. "APIs & Services" → "Credentials" → "Create credentials" →
 *       "OAuth client ID":
 *         • Web application      → put its CLIENT ID in config.google.webClientId.
 *             - Authorized JavaScript origins: http://localhost:13054 (+ prod)
 *             - Authorized redirect URIs:      <your origin>/oauth/google/callback
 *         • Android (optional, for the native build) → SHA-1 + package name →
 *             config.google.androidClientId
 *         • iOS (optional)       → bundle id → config.google.iosClientId
 *    4. The CLIENT SECRET (web) is used ONLY on the BACKEND to exchange the auth
 *       code — NEVER ship it in the frontend.
 *
 *  GITHUB (一键登录):
 *    1. https://github.com/settings/developers → "OAuth Apps" → "New OAuth App"
 *       (or an org's Developer settings for an org-owned app).
 *    2. Homepage URL: your app URL. Authorization callback URL:
 *         <your origin>/oauth/github/callback
 *    3. Put the resulting CLIENT ID in config.github.clientId.
 *    4. The GITHUB CLIENT SECRET lives ONLY on the BACKEND (it exchanges the
 *       `code` for an access token). GitHub has NO secure pure-frontend flow, so
 *       the backend MUST own the secret — see the backend note at the bottom.
 *
 *  Put the public client IDs in ONE place (e.g. config/constants.ts) and call
 *  capSocial.configure({...}) once at app start. They are PUBLIC by design.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * HOW IT WORKS (what this lib returns)
 *   This library only ACQUIRES A CREDENTIAL; it never trusts the client to log
 *   itself in. signInWithGoogle()/signInWithGitHub() resolve to a
 *   CapSocialCredential { provider, code, redirectUri, state } which you hand to
 *   the backend (wordnew: wfNewApi.socialLogin(cred)). The backend exchanges the
 *   `code` (using the server-side client secret), verifies the provider profile,
 *   finds-or-creates the user, and returns the real session token. This is the
 *   only secure model.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Web Google : Google Identity Services (GIS) code client (popup) → `code`.
 *   - Web GitHub : OAuth authorize popup → our /oauth/github/callback → `code`.
 *   - Native     : @capacitor/browser opens the provider authorize URL; the
 *                  callback returns via the app's deep link (captured by
 *                  CapAppState) → `code`. (For true native Google One-Tap, swap
 *                  in @capgo/capacitor-social-login — see comment in signInNativeGoogle.)
 *
 * QUICK START
 *   import { capSocial } from '@/shared/capabilities/CapSocialAuth';
 *   capSocial.configure({
 *     google: { webClientId: GOOGLE_WEB_CLIENT_ID },
 *     github: { clientId: GITHUB_CLIENT_ID },
 *     redirectBase: window.location.origin,   // <origin>/oauth/<provider>/callback
 *   });
 *   const cred = await capSocial.signInWithGoogle();
 *   const session = await wfNewApi.socialLogin(cred);  // backend verifies + logs in
 * ========================================================================== */

import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapSocialProvider = 'google' | 'github';

export interface CapSocialConfig {
  google?: {
    /** OAuth 2.0 Web client ID (PUBLIC). Required for Google sign-in. */
    webClientId?: string;
    /** Native client IDs (only needed for the packaged mobile app). */
    iosClientId?: string;
    androidClientId?: string;
    /** Scopes; default 'openid email profile'. */
    scopes?: string;
  };
  github?: {
    /** GitHub OAuth App client ID (PUBLIC). Required for GitHub sign-in. */
    clientId?: string;
    /** Scopes; default 'read:user user:email'. */
    scopes?: string;
  };
  /**
   * Base origin for the OAuth callback routes. Each provider's redirect URI is
   * `${redirectBase}/oauth/${provider}/callback`. Defaults to window.location.origin.
   * For the NATIVE app set this to your custom scheme / Universal Link host.
   */
  redirectBase?: string;
  /** Native custom-scheme redirect (e.g. 'com.wordnew.app:/oauth'). */
  nativeRedirect?: string;
}

/**
 * The credential handed to the backend. The backend exchanges `code` (with the
 * server-side client secret) for the provider tokens + profile, then issues the
 * real app session. `idToken` is only set for the optional Google One-Tap path.
 */
export interface CapSocialCredential {
  provider: CapSocialProvider;
  /** OAuth authorization code (the normal path). */
  code?: string;
  /** Google One-Tap ID token (JWT) — only when the One-Tap path is used. */
  idToken?: string;
  /** The exact redirect URI used (the backend must pass the SAME value on exchange). */
  redirectUri: string;
  /** CSRF state echoed back; the backend should validate it. */
  state?: string;
  /** PKCE code verifier (when used) — backend includes it in the token exchange. */
  codeVerifier?: string;
  /** Where the credential was obtained (diagnostics). */
  source: 'web' | 'native';
}

export interface CapSocialError {
  code: 'not-configured' | 'cancelled' | 'popup-blocked' | 'unsupported' | 'timeout' | 'unknown';
  message: string;
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function fail(code: CapSocialError['code'], message: string): CapSocialError {
  return { code, message };
}

// ---------------------------------------------------------------------------
// Small utilities (PKCE, state, GIS script loader)
// ---------------------------------------------------------------------------

function randomString(len = 48): string {
  const bytes = new Uint8Array(len);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => ('0' + b.toString(16)).slice(-2)).join('');
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a PKCE pair (S256). Falls back to a plain verifier when subtle is absent. */
async function makePkce(): Promise<{ verifier: string; challenge: string; method: 'S256' | 'plain' }> {
  const verifier = randomString(48);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return { verifier, challenge: base64UrlEncode(digest), method: 'S256' };
  } catch {
    return { verifier, challenge: verifier, method: 'plain' };
  }
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No DOM'));
      return;
    }
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Open an OAuth authorize URL in a popup and resolve once it returns to our
 * redirect URI carrying ?code (& state). Polls the popup's location — readable
 * only after it navigates back to our same-origin callback route. Falls back to
 * rejecting if the popup is closed by the user.
 */
function authorizeViaPopup(url: string, redirectUri: string): Promise<{ code: string; state: string | null }> {
  return new Promise((resolve, reject) => {
    const w = 480;
    const h = 640;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    const popup = window.open(url, 'oauth', `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) {
      reject(fail('popup-blocked', 'The sign-in popup was blocked. Allow popups and retry.'));
      return;
    }
    const redirect = new URL(redirectUri, window.location.origin);
    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          reject(fail('cancelled', 'Sign-in was cancelled.'));
          return;
        }
        // Cross-origin access throws until the popup returns to our origin.
        const loc = popup.location;
        if (loc && loc.origin === redirect.origin && loc.pathname === redirect.pathname) {
          const params = new URLSearchParams(loc.search);
          const code = params.get('code');
          const state = params.get('state');
          clearInterval(timer);
          popup.close();
          if (code) resolve({ code, state });
          else reject(fail('unknown', params.get('error_description') || 'No authorization code returned.'));
        }
      } catch {
        /* still on the provider's origin — keep polling */
      }
    }, 400);
  });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CapSocialAuthService {
  private config: CapSocialConfig = {};
  private readonly native = safeIsNative();
  /** Pending native sign-in resolver, completed by handleRedirectCallback(). */
  private pendingNative: { provider: CapSocialProvider; state: string; verifier?: string; resolve: (c: CapSocialCredential) => void; reject: (e: CapSocialError) => void } | null = null;

  /** Set the public client IDs + redirect base (call once at app start). */
  configure(config: CapSocialConfig): void {
    this.config = { ...this.config, ...config };
  }

  isConfigured(provider: CapSocialProvider): boolean {
    if (provider === 'google') return !!this.config.google?.webClientId;
    return !!this.config.github?.clientId;
  }

  private redirectUri(provider: CapSocialProvider): string {
    if (this.native && this.config.nativeRedirect) return `${this.config.nativeRedirect}/${provider}/callback`;
    const base = this.config.redirectBase || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base.replace(/\/+$/, '')}/oauth/${provider}/callback`;
  }

  // -- public API ---------------------------------------------------------- #

  signIn(provider: CapSocialProvider): Promise<CapSocialCredential> {
    return provider === 'google' ? this.signInWithGoogle() : this.signInWithGitHub();
  }

  /** Acquire a Google credential (web: GIS code popup; native: in-app browser). */
  async signInWithGoogle(): Promise<CapSocialCredential> {
    if (!this.isConfigured('google')) throw fail('not-configured', 'Google webClientId is not set (see CapSocialAuth KEY notes).');
    return this.native ? this.signInNativeGoogle() : this.signInWebGoogle();
  }

  /** Acquire a GitHub credential (web: authorize popup; native: in-app browser). */
  async signInWithGitHub(): Promise<CapSocialCredential> {
    if (!this.isConfigured('github')) throw fail('not-configured', 'GitHub clientId is not set (see CapSocialAuth KEY notes).');
    return this.native ? this.signInNativeGitHub() : this.signInWebGitHub();
  }

  // -- web: Google --------------------------------------------------------- #

  private async signInWebGoogle(): Promise<CapSocialCredential> {
    await loadGis();
    const g = (window as any).google;
    if (!g?.accounts?.oauth2) throw fail('unsupported', 'Google Identity Services unavailable.');
    const redirectUri = this.redirectUri('google');
    return new Promise<CapSocialCredential>((resolve, reject) => {
      try {
        const client = g.accounts.oauth2.initCodeClient({
          client_id: this.config.google!.webClientId,
          scope: this.config.google!.scopes || 'openid email profile',
          ux_mode: 'popup',
          redirect_uri: redirectUri,
          callback: (resp: any) => {
            if (resp?.code) resolve({ provider: 'google', code: resp.code, redirectUri, state: resp.state, source: 'web' });
            else reject(fail(resp?.error === 'access_denied' ? 'cancelled' : 'unknown', resp?.error || 'No code from Google.'));
          },
        });
        client.requestCode();
      } catch (e: any) {
        reject(fail('unknown', String(e?.message || e)));
      }
    });
  }

  // -- web: GitHub --------------------------------------------------------- #

  private async signInWebGitHub(): Promise<CapSocialCredential> {
    const redirectUri = this.redirectUri('github');
    const state = randomString(16);
    const url =
      'https://github.com/login/oauth/authorize?' +
      new URLSearchParams({
        client_id: this.config.github!.clientId!,
        redirect_uri: redirectUri,
        scope: this.config.github!.scopes || 'read:user user:email',
        state,
        allow_signup: 'true',
      }).toString();
    const { code, state: returned } = await authorizeViaPopup(url, redirectUri);
    if (returned && returned !== state) throw fail('unknown', 'OAuth state mismatch (possible CSRF).');
    return { provider: 'github', code, redirectUri, state: returned ?? state, source: 'web' };
  }

  // -- native: in-app browser + deep-link callback ------------------------- #

  private async signInNativeGoogle(): Promise<CapSocialCredential> {
    // For TRUE native Google One-Tap, install @capgo/capacitor-social-login and
    // call its GoogleLogin here, returning { provider:'google', idToken }. We use
    // the universal in-app-browser code flow (PKCE) so no extra native plugin is
    // required and the same backend exchange handles both web and native.
    const redirectUri = this.redirectUri('google');
    const state = randomString(16);
    const pkce = await makePkce();
    const url =
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: this.config.google!.androidClientId || this.config.google!.iosClientId || this.config.google!.webClientId!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: this.config.google!.scopes || 'openid email profile',
        state,
        code_challenge: pkce.challenge,
        code_challenge_method: pkce.method,
      }).toString();
    return this.openNative('google', url, state, pkce.verifier);
  }

  private async signInNativeGitHub(): Promise<CapSocialCredential> {
    const redirectUri = this.redirectUri('github');
    const state = randomString(16);
    const url =
      'https://github.com/login/oauth/authorize?' +
      new URLSearchParams({
        client_id: this.config.github!.clientId!,
        redirect_uri: redirectUri,
        scope: this.config.github!.scopes || 'read:user user:email',
        state,
      }).toString();
    return this.openNative('github', url, state);
  }

  private openNative(provider: CapSocialProvider, url: string, state: string, verifier?: string): Promise<CapSocialCredential> {
    return new Promise<CapSocialCredential>((resolve, reject) => {
      this.pendingNative = { provider, state, verifier, resolve, reject };
      const timeout = setTimeout(() => {
        if (this.pendingNative) {
          this.pendingNative = null;
          reject(fail('timeout', 'Sign-in timed out.'));
        }
      }, 180_000);
      // Wrap resolve/reject to clear the timeout.
      const orig = this.pendingNative;
      this.pendingNative = {
        ...orig,
        resolve: (c) => {
          clearTimeout(timeout);
          resolve(c);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      };
      void Browser.open({ url, windowName: '_self' }).catch((e) => {
        clearTimeout(timeout);
        this.pendingNative = null;
        reject(fail('unknown', String((e as any)?.message || e)));
      });
    });
  }

  /**
   * Feed a redirect/deep-link URL back into the library to complete a NATIVE (or
   * full-redirect web) sign-in. Wire this to CapAppState.registerRoute('/oauth/...')
   * or appUrlOpen on native, and to your /oauth/<provider>/callback page on web.
   * Returns the parsed credential (also resolves the pending native promise).
   */
  handleRedirectCallback(rawUrl: string): CapSocialCredential | null {
    let url: URL;
    try {
      url = new URL(rawUrl, typeof window !== 'undefined' ? window.location.href : 'https://app/');
    } catch {
      return null;
    }
    const params = new URLSearchParams(url.search || url.hash.replace(/^#/, ''));
    const code = params.get('code');
    const state = params.get('state');
    const provider: CapSocialProvider = url.pathname.includes('github') ? 'github' : 'google';
    if (!code) {
      this.pendingNative?.reject(fail('cancelled', params.get('error_description') || 'No authorization code.'));
      this.pendingNative = null;
      return null;
    }
    const cred: CapSocialCredential = {
      provider,
      code,
      redirectUri: this.redirectUri(provider),
      state: state ?? undefined,
      codeVerifier: this.pendingNative?.verifier,
      source: this.native ? 'native' : 'web',
    };
    if (this.pendingNative) {
      if (this.pendingNative.state && state && this.pendingNative.state !== state) {
        this.pendingNative.reject(fail('unknown', 'OAuth state mismatch (possible CSRF).'));
      } else {
        this.pendingNative.resolve(cred);
      }
      this.pendingNative = null;
      void Browser.close().catch(() => {});
    }
    return cred;
  }

  /** Best-effort sign-out hint (clears Google's auto-select). The real session
   *  logout is the app's own (wfNewApi.logout()). */
  async signOut(): Promise<void> {
    try {
      (window as any).google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* ignore */
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capSocial = new CapSocialAuthService();
export const signInWithGoogle = (): Promise<CapSocialCredential> => capSocial.signInWithGoogle();
export const signInWithGitHub = (): Promise<CapSocialCredential> => capSocial.signInWithGitHub();

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseSocialAuthResult {
  busy: boolean;
  /** The provider currently signing in, or null. */
  pending: CapSocialProvider | null;
  error: CapSocialError | null;
  configured: { google: boolean; github: boolean };
  signInGoogle: () => Promise<CapSocialCredential | null>;
  signInGitHub: () => Promise<CapSocialCredential | null>;
}

/**
 * React hook for the login/register social buttons.
 *
 *   const { signInGoogle, busy } = useSocialAuth();
 *   <button disabled={busy} onClick={async () => {
 *     const cred = await signInGoogle();
 *     if (cred) await wfNewApi.socialLogin(cred);
 *   }}>Sign in with Google</button>
 */
export function useSocialAuth(): UseSocialAuthResult {
  const [pending, setPending] = useState<CapSocialProvider | null>(null);
  const [error, setError] = useState<CapSocialError | null>(null);

  const run = useCallback(async (provider: CapSocialProvider): Promise<CapSocialCredential | null> => {
    setPending(provider);
    setError(null);
    try {
      return await capSocial.signIn(provider);
    } catch (e) {
      const err = (e && typeof e === 'object' && 'code' in e ? e : fail('unknown', String((e as any)?.message || e))) as CapSocialError;
      if (err.code !== 'cancelled') setError(err);
      return null;
    } finally {
      setPending(null);
    }
  }, []);

  return {
    busy: pending !== null,
    pending,
    error,
    configured: { google: capSocial.isConfigured('google'), github: capSocial.isConfigured('github') },
    signInGoogle: () => run('google'),
    signInGitHub: () => run('github'),
  };
}

export default capSocial;

/* =============================================================================
 * BACKEND CONTRACT (what the server must implement — see laravel_main AppQyV1)
 * =============================================================================
 *  POST /api/app_qy_v1/auth/social   body: { provider, code, redirect_uri, state?, code_verifier? }
 *    1. Exchange `code` with the provider using the SERVER-SIDE client secret:
 *         - Google: POST https://oauth2.googleapis.com/token (client_id +
 *                   CLIENT_SECRET + code + redirect_uri [+ code_verifier]).
 *         - GitHub: POST https://github.com/login/oauth/access_token (client_id +
 *                   CLIENT_SECRET + code + redirect_uri).
 *    2. Fetch the verified profile (Google userinfo / GitHub /user + /user/emails).
 *    3. Find a user by users.google_id / users.github_id, else by verified email,
 *       else CREATE one. Store the provider id + mark email_verified_at.
 *    4. Issue the app's normal Sanctum token and return { login_token, user }.
 *  POST /api/app_qy_v1/user/social/bind   (auth) body: { provider, code, redirect_uri }
 *  POST /api/app_qy_v1/user/social/unbind (auth) body: { provider }
 *
 *  KEYS LIVE ON THE BACKEND: GOOGLE_CLIENT_SECRET / GITHUB_CLIENT_SECRET (env /
 *  CoreNodeSecrets). The frontend only ever sends the `code`.
 * ========================================================================== */
