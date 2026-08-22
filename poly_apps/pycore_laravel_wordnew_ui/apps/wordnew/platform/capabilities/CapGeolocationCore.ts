/* =============================================================================
 * CapGeolocation — public, cross-platform LOCATION capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew) — e.g. to localize content, time-zone aware review scheduling, or
 *   "study spots" features — but written so the web shell works identically.
 *
 * WHAT IT DOES
 *   - One-shot current position with timeout + accuracy options.
 *   - Continuous watch with start/stop and de-duplicated emits.
 *   - Full permission lifecycle (check / request / open-settings hint).
 *   - Caches the last known position (optionally persisted to localStorage).
 *   - Rich geo helpers: haversine distance, bearing, accuracy buckets, and a
 *     human formatter for coordinates.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor/geolocation (getCurrentPosition / watchPosition /
 *     clearWatch / checkPermissions / requestPermissions).
 *   - Web: navigator.geolocation + navigator.permissions. On the web build the
 *     plugin is aliased to a browser-backed shim, so the native code path also
 *     works when isNativePlatform() happens to be true under a web runtime.
 *
 * QUICK START
 *   import { capGeo, useGeolocation } from '@/apps/wordnew/platform/capabilities/CapGeolocation';
 *   const pos = await capGeo.getCurrentPosition({ enableHighAccuracy: true });
 *   const stop = await capGeo.startWatch();           // emits 'position'
 *   capGeo.on('position', (p) => console.log(p.coords));
 *   // React: const { position, error, permission } = useGeolocation({ watch: true });
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { TypedEventEmitter } from '../../../../core/events/TypedEventEmitter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export interface CapPosition {
  coords: CapCoords;
  timestamp: number;
  /** Where the fix came from. */
  source: 'native' | 'web';
}

export type CapGeoPermission =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'prompt-with-rationale'
  | 'unknown';

export type CapGeoAccuracy = 'exact' | 'high' | 'medium' | 'low' | 'unknown';

export interface CapGeoOptions {
  /** Ask the OS for the most accurate fix it can (costs battery). Default false. */
  enableHighAccuracy?: boolean;
  /** Max time (ms) to wait for a fix before erroring. Default 10000. */
  timeout?: number;
  /** Accept a cached fix up to this age (ms). Default 0 (always fresh). */
  maximumAge?: number;
}

export interface CapGeoServiceOptions extends CapGeoOptions {
  /** Persist the last-known position in localStorage under this key. '' = off. */
  persistKey?: string;
  /**
   * Minimum movement (meters) before a watch emits a new 'position'. Filters
   * GPS jitter. Default 0 (emit everything the OS gives us).
   */
  minDistanceMeters?: number;
  /** Minimum time (ms) between emitted watch updates. Default 0. */
  minIntervalMs?: number;
  /** Optional logger; defaults to no-op. */
  logger?: (msg: string, ...args: unknown[]) => void;
}

export interface CapGeoError {
  code: 'permission-denied' | 'unavailable' | 'timeout' | 'unknown';
  message: string;
}

export interface CapGeoEventMap {
  position: CapPosition;
  error: CapGeoError;
  permission: CapGeoPermission;
}

export type CapGeoListener<K extends keyof CapGeoEventMap> = (p: CapGeoEventMap[K]) => void;

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Geo math + formatting helpers (exported — broadly useful)
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_008.8;
const DEG2RAD = Math.PI / 180;

const DEFAULTS: Required<Omit<CapGeoServiceOptions, 'logger' | 'persistKey'>> &
  Pick<CapGeoServiceOptions, 'logger' | 'persistKey'> = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 0,
  persistKey: 'cap_geo_last_position',
  minDistanceMeters: 0,
  minIntervalMs: 0,
  logger: undefined,
};

/** Great-circle distance (meters) between two lat/lng points (haversine). */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = (bLat - aLat) * DEG2RAD;
  const dLng = (bLng - aLng) * DEG2RAD;
  const lat1 = aLat * DEG2RAD;
  const lat2 = bLat * DEG2RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing (degrees, 0=N clockwise) from point A to point B. */
export function bearingDegrees(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const y = Math.sin((bLng - aLng) * DEG2RAD) * Math.cos(bLat * DEG2RAD);
  const x =
    Math.cos(aLat * DEG2RAD) * Math.sin(bLat * DEG2RAD) -
    Math.sin(aLat * DEG2RAD) * Math.cos(bLat * DEG2RAD) * Math.cos((bLng - aLng) * DEG2RAD);
  const deg = Math.atan2(y, x) / DEG2RAD;
  return (deg + 360) % 360;
}

/** Compass label (N, NE, ...) for a bearing in degrees. */
export function compassLabel(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((bearing % 360) / 45)) % 8];
}

/** Bucket an accuracy radius (m) into a coarse quality label. */
export function accuracyBucket(accuracyMeters: number | null | undefined): CapGeoAccuracy {
  if (accuracyMeters == null || Number.isNaN(accuracyMeters)) return 'unknown';
  if (accuracyMeters <= 10) return 'exact';
  if (accuracyMeters <= 50) return 'high';
  if (accuracyMeters <= 200) return 'medium';
  return 'low';
}

/** Human distance string: "820 m" or "3.4 km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '--';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/** Human coordinate string with N/S/E/W hemispheres. */
export function formatCoords(coords: Pick<CapCoords, 'latitude' | 'longitude'>, digits = 5): string {
  const lat = `${Math.abs(coords.latitude).toFixed(digits)}°${coords.latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(coords.longitude).toFixed(digits)}°${coords.longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

function mapPermission(state: string | undefined): CapGeoPermission {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
      return 'prompt';
    case 'prompt-with-rationale':
      return 'prompt-with-rationale';
    default:
      return 'unknown';
  }
}

function normalizeError(e: any): CapGeoError {
  const msg = String(e?.message || e || 'Geolocation error');
  if (e && typeof e.code === 'number') {
    // Browser GeolocationPositionError codes: 1 denied, 2 unavailable, 3 timeout.
    if (e.code === 1) return { code: 'permission-denied', message: msg };
    if (e.code === 2) return { code: 'unavailable', message: msg };
    if (e.code === 3) return { code: 'timeout', message: msg };
  }
  if (/denied|permission/i.test(msg)) return { code: 'permission-denied', message: msg };
  if (/timeout/i.test(msg)) return { code: 'timeout', message: msg };
  if (/unavailable|not available|unsupported/i.test(msg)) return { code: 'unavailable', message: msg };
  return { code: 'unknown', message: msg };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CapGeolocationService {
  private readonly opts: typeof DEFAULTS;
  private readonly emitter = new TypedEventEmitter<CapGeoEventMap>('CapGeolocation');

  private native = false;
  private permission: CapGeoPermission = 'unknown';
  private lastPosition: CapPosition | null = null;
  private lastEmitAt = 0;

  private watchId: string | null = null;
  private webWatchId: number | null = null;
  private watching = false;

  constructor(options: CapGeoServiceOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.native = safeIsNative();
    this.lastPosition = this.loadPersisted();
  }

  private log(msg: string, ...args: unknown[]): void {
    this.opts.logger?.(`[CapGeolocation] ${msg}`, ...args);
  }

  isNative(): boolean {
    return this.native;
  }
  isWatching(): boolean {
    return this.watching;
  }
  getPermission(): CapGeoPermission {
    return this.permission;
  }
  /** Last known position (possibly from a previous session, if persisted). */
  getLastKnownPosition(): CapPosition | null {
    return this.lastPosition;
  }

  on<K extends keyof CapGeoEventMap>(e: K, fn: CapGeoListener<K>): () => void {
    return this.emitter.on(e, fn);
  }
  once<K extends keyof CapGeoEventMap>(e: K, fn: CapGeoListener<K>): () => void {
    return this.emitter.once(e, fn);
  }
  off<K extends keyof CapGeoEventMap>(e: K, fn: CapGeoListener<K>): void {
    this.emitter.off(e, fn);
  }

  /** Whether the platform exposes geolocation at all. */
  isSupported(): boolean {
    if (this.native) return true;
    try {
      return typeof navigator !== 'undefined' && !!navigator.geolocation;
    } catch {
      return false;
    }
  }

  /** Check (does not prompt) the current permission state. */
  async checkPermissions(): Promise<CapGeoPermission> {
    try {
      if (this.native) {
        const res = await Geolocation.checkPermissions();
        this.permission = mapPermission((res as any).location);
      } else {
        const perm = (navigator as any)?.permissions;
        if (perm?.query) {
          const res = await perm.query({ name: 'geolocation' as PermissionName });
          this.permission = mapPermission(res.state);
        } else {
          this.permission = this.isSupported() ? 'prompt' : 'denied';
        }
      }
    } catch (err) {
      this.log('checkPermissions failed', err);
      this.permission = 'unknown';
    }
    this.emitter.emit('permission', this.permission);
    return this.permission;
  }

  /** Request permission (may prompt). Returns the resulting state. */
  async requestPermissions(): Promise<CapGeoPermission> {
    try {
      if (this.native) {
        const res = await Geolocation.requestPermissions();
        this.permission = mapPermission((res as any).location);
      } else {
        // Browser: a getCurrentPosition call triggers the prompt.
        await this.getCurrentPosition({ timeout: this.opts.timeout });
        this.permission = 'granted';
      }
    } catch (err) {
      this.permission = normalizeError(err).code === 'permission-denied' ? 'denied' : this.permission;
    }
    this.emitter.emit('permission', this.permission);
    return this.permission;
  }

  /** One-shot current position. Throws CapGeoError-shaped errors. */
  async getCurrentPosition(options: CapGeoOptions = {}): Promise<CapPosition> {
    const merged = this.mergeOptions(options);
    try {
      if (this.native) {
        const p = await Geolocation.getCurrentPosition(merged);
        return this.accept(this.fromNative(p));
      }
      const p = await this.webGetCurrent(merged);
      return this.accept(p);
    } catch (err) {
      const e = normalizeError(err);
      this.emitter.emit('error', e);
      throw e;
    }
  }

  /** Start a continuous watch. Returns a stop function. Idempotent. */
  async startWatch(options: CapGeoOptions = {}): Promise<() => Promise<void>> {
    if (this.watching) return () => this.stopWatch();
    const merged = this.mergeOptions(options);
    this.watching = true;
    this.log('startWatch', merged);
    try {
      if (this.native) {
        this.watchId = await Geolocation.watchPosition(merged, (p, err) => {
          if (err) {
            this.emitter.emit('error', normalizeError(err));
            return;
          }
          if (p) this.accept(this.fromNative(p));
        });
      } else {
        const g = navigator?.geolocation;
        if (!g) throw new Error('Geolocation unavailable');
        this.webWatchId = g.watchPosition(
          (p) => this.accept(this.fromWeb(p)),
          (e) => this.emitter.emit('error', normalizeError(e)),
          merged,
        );
      }
    } catch (err) {
      this.watching = false;
      const e = normalizeError(err);
      this.emitter.emit('error', e);
      throw e;
    }
    return () => this.stopWatch();
  }

  /** Stop the active watch (if any). */
  async stopWatch(): Promise<void> {
    if (!this.watching) return;
    this.watching = false;
    this.log('stopWatch');
    try {
      if (this.native && this.watchId) {
        await Geolocation.clearWatch({ id: this.watchId });
      } else if (this.webWatchId != null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(this.webWatchId);
      }
    } catch (err) {
      this.log('stopWatch error', err);
    }
    this.watchId = null;
    this.webWatchId = null;
  }

  /** Distance (m) from the last known fix to a target, or null if no fix. */
  distanceTo(lat: number, lng: number): number | null {
    if (!this.lastPosition) return null;
    const c = this.lastPosition.coords;
    return haversineMeters(c.latitude, c.longitude, lat, lng);
  }

  // -- internals ----------------------------------------------------------- #

  private mergeOptions(o: CapGeoOptions): Required<CapGeoOptions> {
    return {
      enableHighAccuracy: o.enableHighAccuracy ?? this.opts.enableHighAccuracy,
      timeout: o.timeout ?? this.opts.timeout,
      maximumAge: o.maximumAge ?? this.opts.maximumAge,
    };
  }

  private webGetCurrent(options: Required<CapGeoOptions>): Promise<CapPosition> {
    return new Promise<CapPosition>((resolve, reject) => {
      const g = navigator?.geolocation;
      if (!g) {
        reject(new Error('Geolocation unavailable'));
        return;
      }
      g.getCurrentPosition(
        (p) => resolve(this.fromWeb(p)),
        (e) => reject(e),
        options,
      );
    });
  }

  private fromNative(p: any): CapPosition {
    return {
      coords: {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        altitude: p.coords.altitude ?? null,
        altitudeAccuracy: p.coords.altitudeAccuracy ?? null,
        heading: p.coords.heading ?? null,
        speed: p.coords.speed ?? null,
      },
      timestamp: p.timestamp ?? Date.now(),
      source: 'native',
    };
  }

  private fromWeb(p: GeolocationPosition): CapPosition {
    return {
      coords: {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        accuracy: p.coords.accuracy,
        altitude: p.coords.altitude,
        altitudeAccuracy: p.coords.altitudeAccuracy,
        heading: p.coords.heading,
        speed: p.coords.speed,
      },
      timestamp: p.timestamp,
      source: 'web',
    };
  }

  /** Apply jitter/throttle filters, cache, persist and emit. */
  private accept(pos: CapPosition): CapPosition {
    const prev = this.lastPosition;
    const now = Date.now();

    if (prev && this.opts.minDistanceMeters > 0) {
      const moved = haversineMeters(
        prev.coords.latitude,
        prev.coords.longitude,
        pos.coords.latitude,
        pos.coords.longitude,
      );
      if (moved < this.opts.minDistanceMeters) {
        // Below movement threshold: update cache silently, do not emit.
        this.lastPosition = pos;
        return pos;
      }
    }
    if (this.opts.minIntervalMs > 0 && now - this.lastEmitAt < this.opts.minIntervalMs) {
      this.lastPosition = pos;
      return pos;
    }

    this.lastPosition = pos;
    this.lastEmitAt = now;
    this.persist(pos);
    if (this.permission !== 'granted') {
      this.permission = 'granted';
      this.emitter.emit('permission', this.permission);
    }
    this.emitter.emit('position', pos);
    return pos;
  }

  private persist(pos: CapPosition): void {
    if (!this.opts.persistKey) return;
    try {
      window.localStorage.setItem(this.opts.persistKey, JSON.stringify(pos));
    } catch {
      /* ignore quota / SSR */
    }
  }

  private loadPersisted(): CapPosition | null {
    if (!this.opts.persistKey) return null;
    try {
      const raw = window.localStorage.getItem(this.opts.persistKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.coords && typeof parsed.coords.latitude === 'number') return parsed as CapPosition;
    } catch {
      /* ignore */
    }
    return null;
  }

  /** Stop watching + drop listeners. */
  async dispose(): Promise<void> {
    await this.stopWatch();
    this.emitter.clear();
  }
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capGeo = new CapGeolocationService();
export const getCurrentPosition = (o?: CapGeoOptions): Promise<CapPosition> =>
  capGeo.getCurrentPosition(o);
export const watchPosition = (o?: CapGeoOptions): Promise<() => Promise<void>> => capGeo.startWatch(o);

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface UseGeolocationResult {
  position: CapPosition | null;
  error: CapGeoError | null;
  permission: CapGeoPermission;
  loading: boolean;
  /** Manually (re)request a one-shot fix. */
  refresh: () => Promise<void>;
  /** Trigger the OS permission prompt. */
  requestPermission: () => Promise<void>;
}

export interface UseGeolocationOptions extends CapGeoOptions {
  /** Continuously watch instead of a single fix. Default false. */
  watch?: boolean;
  /** Fetch immediately on mount. Default true. */
  immediate?: boolean;
}

/**
 * React hook over the shared geolocation service.
 *
 *   const { position, error, permission, refresh } = useGeolocation({ watch: true });
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const { watch = false, immediate = true, ...geoOpts } = options;
  const [position, setPosition] = useState<CapPosition | null>(() => capGeo.getLastKnownPosition());
  const [error, setError] = useState<CapGeoError | null>(null);
  const [permission, setPermission] = useState<CapGeoPermission>(() => capGeo.getPermission());
  const [loading, setLoading] = useState<boolean>(false);
  const optsRef = useRef(geoOpts);
  optsRef.current = geoOpts;

  const refresh = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const p = await capGeo.getCurrentPosition(optsRef.current);
      setPosition(p);
    } catch (e) {
      setError(e as CapGeoError);
    } finally {
      setLoading(false);
    }
  };

  const requestPermission = async (): Promise<void> => {
    setPermission(await capGeo.requestPermissions());
  };

  useEffect(() => {
    let mounted = true;
    const offPos = capGeo.on('position', (p) => mounted && setPosition(p));
    const offErr = capGeo.on('error', (e) => mounted && setError(e));
    const offPerm = capGeo.on('permission', (p) => mounted && setPermission(p));
    void capGeo.checkPermissions();

    let stop: (() => Promise<void>) | null = null;
    if (watch) {
      void capGeo.startWatch(optsRef.current).then((s) => {
        if (mounted) stop = s;
        else void s();
      });
    } else if (immediate) {
      void refresh();
    }

    return () => {
      mounted = false;
      offPos();
      offErr();
      offPerm();
      if (stop) void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, immediate]);

  return { position, error, permission, loading, refresh, requestPermission };
}

export default capGeo;

