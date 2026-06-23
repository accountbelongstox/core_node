/**
 * Avatar URL Utility Library
 * 
 * Unified avatar URL generation and processing
 * Reason: Avatar URLs must be generated dynamically based on current API endpoint
 * Solution: Store only seed, generate absolute URL at runtime
 */

import { apiManager } from '../services/ApiManager';
import { API_ENDPOINTS, buildApiUrl } from '../config/api-endpoints';

// Note: This utility can be used outside React components
// For React components, use useOrigin() hook from OriginContext instead

/**
 * Generate avatar URL with absolute path
 * API endpoint is determined from browser side, not backend
 * Uses browser's current origin as fallback to ensure API is accessible from browser
 * @param seed - User identifier (id, name, email, etc.)
 * @param size - Avatar size in pixels (default: 150)
 * @param provider - Avatar provider (default: 'pravatar')
 * @returns Absolute avatar URL
 */
export function generateAvatarUrl(seed: string, size: number = 150, provider: string = 'pravatar'): string {
  // Priority 1: Use current API endpoint from ApiManager (browser-detected)
  const currentBaseUrl = apiManager.getCurrentBaseUrl();
  if (currentBaseUrl) {
    return `${currentBaseUrl.replace(/\/$/, '')}/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
  }

  // Priority 2: Use browser's current origin (ensures API is accessible from browser)
  // This is the correct approach - API must be accessible from browser, not backend
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
  }

  // Priority 3: Fallback to first endpoint in config (only if window is not available)
  const fallbackUrl = API_ENDPOINTS.length > 0 ? buildApiUrl(API_ENDPOINTS[0]) : null;
  if (fallbackUrl) {
    return `${fallbackUrl.replace(/\/$/, '')}/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
  }

  // Last resort: Use localhost (should never reach here in browser)
  return `http://localhost:9000/api/public/avatar/${encodeURIComponent(seed)}?size=${size}&provider=${provider}`;
}

/**
 * Extract seed from avatar URL or return seed if already a seed
 * @param avatarValue - Avatar URL or seed string
 * @returns Seed string
 */
export function extractAvatarSeed(avatarValue: string | undefined | null): string {
  if (!avatarValue) return 'user';
  
  // If already a seed (no http and no leading /), return as-is
  if (!avatarValue.includes('http') && !avatarValue.startsWith('/')) {
    return avatarValue;
  }
  
  // Extract seed from URL: /api/public/avatar/{seed}?...
  const match = avatarValue.match(/\/api\/public\/avatar\/([^?]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }
  
  // Try extracting from relative path
  if (avatarValue.startsWith('/api/public/avatar/')) {
    const parts = avatarValue.split('/');
    const seedPart = parts[parts.length - 1]?.split('?')[0];
    if (seedPart) {
      return decodeURIComponent(seedPart);
    }
  }
  
  return 'user';
}

/**
 * Generate avatar URL from seed or URL
 * Handles both seed strings and full URLs
 */
export function getAvatarUrl(avatarValue: string | undefined | null, size: number = 150, provider: string = 'pravatar'): string {
  const seed = extractAvatarSeed(avatarValue);
  return generateAvatarUrl(seed, size, provider);
}

