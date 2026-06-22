/* [v4.1-Iris] Wf user center — ported from qy_capacitor/services/UserDataCenter.ts
 * + UserProfileEnsurer.ts (normalization side only), re-shaped for the Wf shell:
 * profile fetch goes through wordflowApi.getUserProfile() (which owns the 5-min
 * TTL storage cache); this layer adds a ~5-min in-memory cache on top, the
 * field normalization the pages used to do defensively (email→username
 * fallback, avatar URL construction, bio/phone/gender/age cleanup) and a
 * clear() the app context calls on logout/login so a stale profile never leaks
 * across sessions. */

import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { apiManager } from '../../../core/api-libs/wordflow/WordflowApiManager';
import { StorageCenter, StorageKey } from '../../../core/api-libs/wordflow/WordflowStorage';
import type { User } from '../../../core/api-libs/wordflow/wordflowTypes';

/** In-memory profile cache lifetime (mirrors the API layer's 5-min TTL). */
const PROFILE_TTL_MS = 5 * 60 * 1000;

/**
 * Normalized profile view: the typed User plus the extended backend fields the
 * profile pages read, with every optional string trimmed (empty → undefined),
 * gender constrained and age coerced to a finite positive number.
 */
export interface WfUserProfile extends User {
  bio?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  birthday?: string;
  location?: string;
  city?: string;
  occupation?: string;
  education?: string;
  website?: string;
  github?: string;
  wechat?: string;
  weibo?: string;
  qq?: string;
}

/** Trimmed non-empty string, else undefined. */
function cleanString(value: any): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Constrained gender value, else undefined. */
function cleanGender(value: any): 'male' | 'female' | 'other' | undefined {
  const g = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return g === 'male' || g === 'female' || g === 'other' ? g : undefined;
}

/** Finite positive age number (accepts numeric strings), else undefined. */
function cleanAge(value: any): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
}

class WfUserCenterClass {
  private cachedProfile: WfUserProfile | null = null;
  private cachedAt = 0;
  private loadPromise: Promise<WfUserProfile | null> | null = null;

  /**
   * Normalize a raw user object (qy UserDataCenter.processUserData):
   * - username falls back to the email local-part (qy UserProfileEnsurer's
   *   generateNickname source order);
   * - avatar_url is resolved to a full URL when a real avatar exists
   *   (http passthrough / `avatars/{app}/...` → `/api/files/avatars/...` /
   *   generic path → `/api/files/...`); when none exists it stays undefined so
   *   callers can render their own initials fallback — use
   *   getDefaultAvatarUrl() for a guaranteed image;
   * - extended fields (bio/phone/gender/age/...) are cleaned as documented on
   *   WfUserProfile.
   */
  normalize(user: User): WfUserProfile {
    const raw = user as any;
    const username =
      cleanString(raw.username) ??
      (typeof raw.email === 'string' && raw.email.includes('@')
        ? cleanString(raw.email.split('@')[0])
        : undefined);

    return {
      ...user,
      username,
      avatar_url: this.getAvatarUrl(user),
      bio: cleanString(raw.bio),
      phone: cleanString(raw.phone),
      gender: cleanGender(raw.gender),
      age: cleanAge(raw.age),
      birthday: cleanString(raw.birthday),
      location: cleanString(raw.location),
      city: cleanString(raw.city),
      occupation: cleanString(raw.occupation),
      education: cleanString(raw.education),
      website: cleanString(raw.website),
      github: cleanString(raw.github),
      wechat: cleanString(raw.wechat),
      weibo: cleanString(raw.weibo),
      qq: cleanString(raw.qq),
    } as WfUserProfile;
  }

  /**
   * Resolve a real avatar to a full URL (qy UserDataCenter.getAvatarUrl
   * priorities 1–2). Returns undefined when the user has no avatar at all —
   * the ui-avatars default lives in getDefaultAvatarUrl() so pages keep their
   * own initials-chip fallback.
   */
  getAvatarUrl(user: User | null | undefined): string | undefined {
    const raw = user as any;
    if (raw?.avatar_url && typeof raw.avatar_url === 'string' && raw.avatar_url.startsWith('http')) {
      return raw.avatar_url;
    }
    const avatar = typeof raw?.avatar === 'string' ? raw.avatar : '';
    if (!avatar) return undefined;
    if (avatar.startsWith('http')) return avatar;

    const baseUrl = apiManager.getCurrentBaseUrl();
    // Expected format: "avatars/{app}/avatar_xxx.png" (nested paths tolerated).
    const parts = avatar.split('/');
    if (parts.length >= 3 && parts[0] === 'avatars') {
      const app = parts[1];
      const filename = parts.slice(2).join('/');
      return `${baseUrl}/api/files/avatars/${app}/${filename}`;
    }
    // Fallback: treat as a generic file path.
    return `${baseUrl}/api/files/${avatar}`;
  }

  /**
   * Guaranteed avatar image (qy UserDataCenter.getAvatarUrl priority 3):
   * the resolved real avatar, else a ui-avatars placeholder seeded with the
   * display name.
   */
  getDefaultAvatarUrl(user: User | null | undefined): string {
    const resolved = this.getAvatarUrl(user);
    if (resolved) return resolved;
    const displayName = this.getDisplayName(user);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=3b82f6&color=fff&size=200`;
  }

  /**
   * Display name chain: name → nickname → username (incl. the email-derived
   * fallback) → 'User'.
   */
  getDisplayName(user: User | null | undefined): string {
    if (!user) return 'Guest';
    const raw = user as any;
    return (
      cleanString(raw.name) ??
      cleanString(raw.nickname) ??
      cleanString(raw.username) ??
      (typeof raw.email === 'string' && raw.email.includes('@')
        ? cleanString(raw.email.split('@')[0])
        : undefined) ??
      'User'
    );
  }

  /**
   * Pro/premium detection from the backend's VipClub fields: member_type is a
   * freeform column where empty/'free'/'normal'/'basic' mean the free tier and
   * anything else (vip/pro/premium/...) is a paid plan. The User type's legacy
   * `isPro` boolean is honored as an override when present.
   */
  isPro(user: User | null | undefined): boolean {
    if (!user) return false;
    const raw = user as any;
    if (raw.isPro === true) return true;
    const memberType = cleanString(raw.member_type)?.toLowerCase();
    return !!memberType && !['free', 'normal', 'basic', 'default'].includes(memberType);
  }

  /**
   * Human plan label for badges: 'Free Plan' on the free tier, else the
   * member_type capitalized (e.g. 'vip' → 'VIP Plan', 'premium' → 'Premium Plan').
   */
  getPlanLabel(user: User | null | undefined): string {
    if (!this.isPro(user)) return 'Free Plan';
    const memberType = cleanString((user as any)?.member_type) ?? 'Pro';
    const pretty = memberType.length <= 3
      ? memberType.toUpperCase()
      : memberType.charAt(0).toUpperCase() + memberType.slice(1).toLowerCase();
    return `${pretty} Plan`;
  }

  /** Initials for the avatar fallback chip (qy UserDataCenter.getUserInitials). */
  getInitials(user: User | null | undefined): string {
    const displayName = this.getDisplayName(user);
    const parts = displayName.split(' ');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }

  /**
   * Fetch + normalize the profile. ~5-min in-memory cache on top of the API
   * layer's storage cache; concurrent calls share one request. Pass force=true
   * to drop both caches and re-fetch.
   */
  async getProfile(force?: boolean): Promise<WfUserProfile | null> {
    if (force) {
      this.cachedProfile = null;
      this.cachedAt = 0;
      this.loadPromise = null;
    }
    if (this.cachedProfile && Date.now() - this.cachedAt < PROFILE_TTL_MS) {
      return this.cachedProfile;
    }
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const user = force
          ? await wordflowApi.refreshUserProfile()
          : await wordflowApi.getUserProfile();
        if (!user) return null;
        this.cachedProfile = this.normalize(user);
        this.cachedAt = Date.now();
        return this.cachedProfile;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Drop the in-memory profile and the API layer's storage cache. Called by
   * WfAppContext on logout (and login) so the next session never sees a stale
   * profile.
   */
  clear(): void {
    this.cachedProfile = null;
    this.cachedAt = 0;
    this.loadPromise = null;
    StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
  }
}

export const wfUserCenter = new WfUserCenterClass();
