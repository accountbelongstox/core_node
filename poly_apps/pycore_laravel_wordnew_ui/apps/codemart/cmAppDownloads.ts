/**
 * Central CodeMart mobile-app download metadata. Update the URLs here when a
 * new artifact is published; the download page and every entry point read
 * from this single source. Version tracks flavors/codemart/flavor.json.
 */
export type CmAppPlatform = 'android' | 'ios';

export interface CmAppDownload {
  platform: CmAppPlatform;
  version: string;
  url: string;
  /** Free-form requirement line rendered as-is per locale key instead. */
  minOsKey: string;
}

export const CM_APP_DOWNLOADS: Record<CmAppPlatform, CmAppDownload> = {
  android: {
    platform: 'android',
    version: '1.0.0',
    url: '/downloads/codemart/codemart-1.0.0-release.apk',
    minOsKey: 'downloadPage.androidMinOs',
  },
  ios: {
    platform: 'ios',
    version: '1.0.0',
    url: 'https://apps.apple.com/app/codemart',
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
