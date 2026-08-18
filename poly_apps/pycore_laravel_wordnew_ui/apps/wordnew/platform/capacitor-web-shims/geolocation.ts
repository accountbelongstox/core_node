/**
 * Web shim for @capacitor/geolocation.
 *
 * Backs the Capacitor Geolocation plugin API with the browser
 * `navigator.geolocation` + `navigator.permissions` APIs so that, in the web
 * build (where `@capacitor/geolocation` is aliased to this file — see
 * vite.config.ts), any caller of the plugin keeps working unchanged. The
 * high-level capability wrapper (apps/wordnew/platform/capabilities/CapGeolocation.ts) prefers
 * its own browser path on web and the native plugin on device; this shim simply
 * guarantees the import resolves and behaves on a plain web page too.
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build),
 * with this browser fallback for the web shell.
 */

export interface Position {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitudeAccuracy?: number | null;
    altitude: number | null;
    speed: number | null;
    heading: number | null;
  };
}

export interface PositionOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

export interface PermissionStatus {
  location: PermissionState;
  coarseLocation: PermissionState;
}

export type WatchPositionCallback = (position: Position | null, err?: any) => void;

function mapPosition(p: GeolocationPosition): Position {
  return {
    timestamp: p.timestamp,
    coords: {
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      accuracy: p.coords.accuracy,
      altitudeAccuracy: p.coords.altitudeAccuracy,
      altitude: p.coords.altitude,
      speed: p.coords.speed,
      heading: p.coords.heading,
    },
  };
}

function geo(): Geolocation | null {
  try {
    return typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null;
  } catch {
    return null;
  }
}

// Browser watch ids are numbers; the Capacitor API uses string ids. Keep a map.
const watchMap = new Map<string, number>();
let watchSeq = 0;

export const Geolocation = {
  async getCurrentPosition(options?: PositionOptions): Promise<Position> {
    const g = geo();
    if (!g) throw new Error('Geolocation is not available in this browser.');
    return new Promise<Position>((resolve, reject) => {
      g.getCurrentPosition(
        (p) => resolve(mapPosition(p)),
        (e) => reject(new Error(e.message || 'Geolocation error')),
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? false,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 0,
        },
      );
    });
  },

  async watchPosition(options: PositionOptions, callback: WatchPositionCallback): Promise<string> {
    const g = geo();
    if (!g) {
      callback(null, new Error('Geolocation is not available in this browser.'));
      return 'unavailable';
    }
    const id = g.watchPosition(
      (p) => callback(mapPosition(p)),
      (e) => callback(null, new Error(e.message || 'Geolocation error')),
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? false,
        timeout: options?.timeout ?? 10000,
        maximumAge: options?.maximumAge ?? 0,
      },
    );
    const key = `web-watch-${++watchSeq}`;
    watchMap.set(key, id);
    return key;
  },

  async clearWatch(options: { id: string }): Promise<void> {
    const g = geo();
    const id = watchMap.get(options.id);
    if (g && typeof id === 'number') g.clearWatch(id);
    watchMap.delete(options.id);
  },

  async checkPermissions(): Promise<PermissionStatus> {
    try {
      const perm = (navigator as any)?.permissions;
      if (perm?.query) {
        const res = await perm.query({ name: 'geolocation' as PermissionName });
        const state = (res.state as PermissionState) ?? 'prompt';
        return { location: state, coarseLocation: state };
      }
    } catch {
      /* fall through */
    }
    // Without the Permissions API we cannot know without prompting.
    const state: PermissionState = geo() ? 'prompt' : 'denied';
    return { location: state, coarseLocation: state };
  },

  async requestPermissions(): Promise<PermissionStatus> {
    // The browser has no explicit request; a getCurrentPosition call triggers
    // the prompt. We attempt a cheap fix and report the resulting state.
    try {
      await this.getCurrentPosition({ timeout: 8000 });
      return { location: 'granted', coarseLocation: 'granted' };
    } catch {
      return this.checkPermissions();
    }
  },
};

export default { Geolocation };
