import { CM_APP_VERSION } from './cmFlavor';

/**
 * CodeMart mobile-app download metadata. The list of published packages is
 * served by `GET /public/app-downloads` (operator setting
 * `codemartv1_app_downloads`); an empty list means "not published yet" and
 * the download page says so instead of probing artifact URLs. The fallback
 * version comes from flavors/codemart/flavor.json for display only.
 */
export type CmAppPlatform = 'android' | 'ios';

export interface CmAppDownload {
  platform: CmAppPlatform;
  version: string;
  url: string;
  /** Minimum OS version number, served by the backend per package. */
  minOs: string;
}

export const CM_APP_FALLBACK_VERSION = CM_APP_VERSION;

export const CM_APP_MIN_OS_KEYS: Record<CmAppPlatform, string> = {
  android: 'downloadPage.androidMinOs',
  ios: 'downloadPage.iosMinOs',
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
