/**
 * Web shim for @capacitor/device.
 *
 * Backs the Capacitor Device plugin with browser APIs: the (deprecated but
 * still-present in many engines) Battery Status API for getBatteryInfo, and
 * navigator.userAgent / navigator.language for getInfo / language helpers. On
 * the web build `@capacitor/device` is aliased to this file (see vite.config).
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working.
 */

export interface DeviceInfo {
  model: string;
  platform: 'ios' | 'android' | 'web';
  operatingSystem: 'ios' | 'android' | 'windows' | 'mac' | 'unknown';
  osVersion: string;
  manufacturer: string;
  isVirtual: boolean;
  webViewVersion: string;
}

export interface BatteryInfo {
  /** 0..1 charge fraction, or undefined when unknown. */
  batteryLevel?: number;
  isCharging?: boolean;
}

export interface DeviceId {
  identifier: string;
}

export interface GetLanguageCodeResult {
  value: string;
}

export interface LanguageTag {
  value: string;
}

function ua(): string {
  try {
    return navigator?.userAgent ?? '';
  } catch {
    return '';
  }
}

function detectOS(): DeviceInfo['operatingSystem'] {
  const s = ua().toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  if (/android/.test(s)) return 'android';
  if (/windows/.test(s)) return 'windows';
  if (/mac os x|macintosh/.test(s)) return 'mac';
  return 'unknown';
}

async function batteryManager(): Promise<any | null> {
  try {
    const nav = navigator as any;
    if (typeof nav?.getBattery === 'function') return await nav.getBattery();
  } catch {
    /* unsupported */
  }
  return null;
}

export const Device = {
  async getInfo(): Promise<DeviceInfo> {
    const os = detectOS();
    return {
      model: 'web',
      platform: 'web',
      operatingSystem: os,
      osVersion: '',
      manufacturer: 'web',
      isVirtual: false,
      webViewVersion: ua(),
    };
  },

  async getBatteryInfo(): Promise<BatteryInfo> {
    const bm = await batteryManager();
    if (!bm) return { batteryLevel: undefined, isCharging: undefined };
    return {
      batteryLevel: typeof bm.level === 'number' ? bm.level : undefined,
      isCharging: typeof bm.charging === 'boolean' ? bm.charging : undefined,
    };
  },

  async getId(): Promise<DeviceId> {
    // Stable-ish per-browser id persisted in localStorage.
    const KEY = '__cap_web_device_id__';
    try {
      const ls = window.localStorage;
      let id = ls.getItem(KEY);
      if (!id) {
        id = 'web-' + Math.abs(hashString(ua() + ':' + Date.now())).toString(36);
        ls.setItem(KEY, id);
      }
      return { identifier: id };
    } catch {
      return { identifier: 'web-unknown' };
    }
  },

  async getLanguageCode(): Promise<GetLanguageCodeResult> {
    const tag = (typeof navigator !== 'undefined' && navigator.language) || 'en';
    return { value: tag.split('-')[0] };
  },

  async getLanguageTag(): Promise<LanguageTag> {
    return { value: (typeof navigator !== 'undefined' && navigator.language) || 'en' };
  },
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export default { Device };
