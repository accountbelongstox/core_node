/**
 * Image URL Utility Library
 * 
 * Unified image URL generation and processing utility
 * References old .js code image processing logic, uses multi-API system to generate absolute URLs
 * 
 * Features:
 * - Uses current API endpoint (current Api Url) to generate absolute URL (abs-api-url)
 * - Supports multiple image types: avatar, upload, static, etc.
 * - Automatically handles relative and absolute paths
 * - Supports image URL generation for user identifiers like customer1
 * 
 * Priority:
 * 1. Use current API endpoint detected by ApiManager
 * 2. Use browser's current origin
 * 3. Use first endpoint in config as fallback
 */

import { apiManager } from '../services/ApiManager';
import { API_ENDPOINTS, buildApiUrl } from '../config/api-endpoints';

/**
 * Image type enumeration
 */
export type ImageType = 'avatar' | 'upload' | 'static' | 'cache' | 'encrypted';

/**
 * Generate absolute URL for image
 * Uses current API endpoint from multi-API system
 * 
 * @param relativePath - Relative path, e.g. "avatars/appqyv1/avatar_1.png" or "customer1"
 * @param imageType - Image type, defaults to 'avatar'
 * @param options - Additional options
 * @returns Absolute URL
 */
export function generateImageUrl(
  relativePath: string | null | undefined,
  imageType: ImageType = 'avatar',
  options: {
    size?: number;
    provider?: string;
    [key: string]: any;
  } = {}
): string {
  if (!relativePath) {
    return '';
  }

  // If already absolute URL, return directly
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // If blob URL, return directly
  if (relativePath.startsWith('blob:')) {
    return relativePath;
  }

  // If data URL, return directly
  if (relativePath.startsWith('data:')) {
    return relativePath;
  }

  // Get current API base URL
  const currentBaseUrl = apiManager.getCurrentBaseUrl();
  
  // Build complete API path
  let apiPath = '';
  
  switch (imageType) {
    case 'avatar':
      // Avatar type: use avatar API, supports seed (e.g. customer1) or relative path
      if (!relativePath.includes('/') && !relativePath.includes('.')) {
        // Looks like a seed (e.g. customer1), use avatar API
        const { size = 150, provider = 'pravatar' } = options;
        apiPath = `/api/public/avatar/${encodeURIComponent(relativePath)}?size=${size}&provider=${provider}`;
      } else {
        // Relative path, use files API
        apiPath = `/api/files/avatars/${relativePath}`;
      }
      break;
      
    case 'upload':
      apiPath = `/api/files/uploads/${relativePath}`;
      break;
      
    case 'static':
      apiPath = `/api/files/static/${relativePath}`;
      break;
      
    case 'cache':
      apiPath = `/api/files/cache/${relativePath}`;
      break;
      
    case 'encrypted':
      // Encrypted images: use relative path directly (e.g. /encrypted_assets/app_icon1.en.js)
      // These files are in public directory, no API endpoint needed
      if (relativePath.startsWith('/')) {
        return relativePath;
      }
      return `/${relativePath}`;
      
    default:
      apiPath = `/api/files/${imageType}/${relativePath}`;
  }

  // Priority 1: Use current API endpoint
  if (currentBaseUrl) {
    return `${currentBaseUrl.replace(/\/$/, '')}${apiPath}`;
  }

  // Priority 2: Use browser's current origin
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}${apiPath}`;
  }

  // Priority 3: Use first endpoint in config as fallback
  const fallbackUrl = API_ENDPOINTS.length > 0 ? buildApiUrl(API_ENDPOINTS[0]) : null;
  if (fallbackUrl) {
    return `${fallbackUrl.replace(/\/$/, '')}${apiPath}`;
  }

  // Last fallback: localhost
  return `http://localhost:9000${apiPath}`;
}

/**
 * Generate Avatar URL for user identifiers (customer1, etc.)
 * Convenience method for generateImageUrl, specifically for avatars
 * 
 * @param seed - User identifier, e.g. 'customer1'
 * @param size - Avatar size, defaults to 150
 * @param provider - Avatar provider, defaults to 'pravatar'
 * @returns Absolute URL
 */
export function getImageUrlForCustomer(
  seed: string | null | undefined,
  size: number = 150,
  provider: string = 'pravatar'
): string {
  return generateImageUrl(seed || 'user', 'avatar', { size, provider });
}

/**
 * Generate generic image URL
 * Automatically detects image type and generates URL
 * 
 * @param path - Image path or identifier
 * @param imageType - Image type
 * @returns Absolute URL
 */
export function getImageUrl(
  path: string | null | undefined,
  imageType: ImageType = 'avatar'
): string {
  return generateImageUrl(path, imageType);
}

/**
 * Extract relative path or seed from URL
 * 
 * @param url - Complete URL or relative path
 * @returns Extracted relative path or seed
 */
export function extractImagePath(url: string | null | undefined): string {
  if (!url) return '';
  
  // If already a seed (no http and /), return directly
  if (!url.includes('http') && !url.startsWith('/') && !url.includes('.')) {
    return url;
  }
  
  // Extract path from URL
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    // Not a valid URL, might be relative path
    return url;
  }
}

/**
 * Check if URL is absolute URL
 * 
 * @param url - URL string
 * @returns Whether URL is absolute
 */
export function isAbsoluteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:');
}

