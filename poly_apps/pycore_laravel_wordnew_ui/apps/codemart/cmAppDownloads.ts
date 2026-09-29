import { CM_APP_VERSION } from './cmFlavor';

const ANDROID_DOWNLOAD_URL = CM_APP_VERSION ? `/downloads/codemart/codemart-${CM_APP_VERSION}-release.apk` : '';
const IOS_DOWNLOAD_URL = 'https://apps.apple.com/app/codemart';
const PROBE_TIMEOUT_MS = 6000;
const HTML_CONTENT_TYPE = 'text/html';

/**
 * Central CodeMart mobile-app download metadata. Update the URLs here when a
 * new artifact is published; the download page and every entry point read
 * from this single source. The version comes from flavors/codemart/flavor.json.
 */
export type CmAppPlatform = 'android' | 'ios';

export interface CmAppDownload {
  platform: CmAppPlatform;
  version: string;
  /** Empty when no artifact is published; the card is then hidden. */
  url: string;
  /** Free-form requirement line rendered as-is per locale key instead. */
  minOsKey: string;
}

export const CM_APP_DOWNLOADS: Record<CmAppPlatform, CmAppDownload> = {
  android: {
    platform: 'android',
    version: CM_APP_VERSION,
    url: ANDROID_DOWNLOAD_URL,
    minOsKey: 'downloadPage.androidMinOs',
  },
  ios: {
    platform: 'ios',
    version: CM_APP_VERSION,
    url: IOS_DOWNLOAD_URL,
    minOsKey: 'downloadPage.iosMinOs',
  },
};

export function detectMobilePlatform(): CmAppPlatform | null {
  if (typeof navigator === 'undefined') return null;
  const agent = navigator.userAgent || '';
  if (/android/i.test(agent)) return 'android';
  if (/iPad|iPhone|iPod/.test(agent)) return 'ios';
  // iPadOS 13+ reports as Macintosh but has touch points.
  if (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1) return 'ios';
  return null;
}

/**
 * HEAD-probe a download artifact. Same-origin URLs must answer OK with a
 * non-HTML body (the SPA fallback returns HTML for missing files); cross-origin
 * store links cannot be inspected, so any network answer counts as reachable.
 */
export async function isCmDownloadReachable(url: string): Promise<boolean> {
  if (!url.trim() || typeof window === 'undefined') return false;
  const target = new URL(url, window.location.href);
  const sameOrigin = target.origin === window.location.origin;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(target.href, {
      method: 'HEAD',
      mode: sameOrigin ? 'same-origin' : 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!sameOrigin) return true;
    const contentType = response.headers.get('content-type') ?? '';
    return response.ok && !contentType.includes(HTML_CONTENT_TYPE);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
