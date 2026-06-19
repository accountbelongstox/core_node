/* =============================================================================
 * CapGeolocation — public, cross-platform LOCATION capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordflow_ui.
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
 *   import { capGeo, useGeolocation } from '@/shared/capabilities/CapGeolocation';
 *   const pos = await capGeo.getCurrentPosition({ enableHighAccuracy: true });
 *   const stop = await capGeo.startWatch();           // emits 'position'
 *   capGeo.on('position', (p) => console.log(p.coords));
 *   // React: const { position, error, permission } = useGeolocation({ watch: true });
 * ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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

class Emitter<M> {
  private map = new Map<keyof M, Set<(p: any) => void>>();
  on<K extends keyof M>(e: K, fn: (p: M[K]) => void): () => void {
    let s = this.map.get(e);
    if (!s) {
      s = new Set();
      this.map.set(e, s);
    }
    s.add(fn as any);
    return () => this.off(e, fn);
  }
  once<K extends keyof M>(e: K, fn: (p: M[K]) => void): () => void {
    const off = this.on(e, (p) => {
      off();
      fn(p);
    });
    return off;
  }
  off<K extends keyof M>(e: K, fn: (p: M[K]) => void): void {
    this.map.get(e)?.delete(fn as any);
  }
  emit<K extends keyof M>(e: K, p: M[K]): void {
    const s = this.map.get(e);
    if (!s) return;
    for (const fn of Array.from(s)) {
      try {
        fn(p);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[CapGeolocation] listener error', err);
      }
    }
  }
  clear(): void {
    this.map.clear();
  }
}

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
  private readonly emitter = new Emitter<CapGeoEventMap>();

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

// ===========================================================================
// EXTENDED CAPABILITIES — DMS formatting, geodesy, geofencing
// ===========================================================================
//
// Built primarily for the wordnew mobile APP: "study spots", distance-to-target
// badges, and arrive/leave triggers all need a little geodesy + a geofence
// monitor on top of the raw position stream.

/** Format a single coordinate component as degrees/minutes/seconds. */
export function toDMS(value: number, isLat: boolean): string {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${deg}°${min}'${sec.toFixed(1)}"${hemi}`;
}

/** Format a coordinate pair as DMS, e.g. 22°32'15.0"N, 114°03'30.0"E. */
export function formatCoordsDMS(coords: Pick<CapCoords, 'latitude' | 'longitude'>): string {
  return `${toDMS(coords.latitude, true)}, ${toDMS(coords.longitude, false)}`;
}

/** Convert a m/s speed to km/h (returns null for null/unknown). */
export function speedKmh(speedMs: number | null): number | null {
  return speedMs == null ? null : speedMs * 3.6;
}

/** Human speed label, e.g. "5.4 km/h" or "--". */
export function formatSpeed(speedMs: number | null): string {
  const kmh = speedKmh(speedMs);
  return kmh == null ? '--' : `${kmh.toFixed(1)} km/h`;
}

/**
 * Destination point given a start, a bearing (deg) and a distance (m).
 * Useful to draw a radius or project an estimated position.
 */
export function destinationPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceMeters: number,
): { latitude: number; longitude: number } {
  const angular = distanceMeters / EARTH_RADIUS_M;
  const brng = bearingDeg * DEG2RAD;
  const lat1 = lat * DEG2RAD;
  const lng1 = lng * DEG2RAD;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: lat2 / DEG2RAD, longitude: ((lng2 / DEG2RAD + 540) % 360) - 180 };
}

/** Midpoint between two coordinates. */
export function midpoint(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { latitude: number; longitude: number } {
  const φ1 = aLat * DEG2RAD;
  const φ2 = bLat * DEG2RAD;
  const Δλ = (bLng - aLng) * DEG2RAD;
  const bx = Math.cos(φ2) * Math.cos(Δλ);
  const by = Math.cos(φ2) * Math.sin(Δλ);
  const φ3 = Math.atan2(
    Math.sin(φ1) + Math.sin(φ2),
    Math.sqrt((Math.cos(φ1) + bx) ** 2 + by ** 2),
  );
  const λ3 = aLng * DEG2RAD + Math.atan2(by, Math.cos(φ1) + bx);
  return { latitude: φ3 / DEG2RAD, longitude: ((λ3 / DEG2RAD + 540) % 360) - 180 };
}

/** Axis-aligned bounding box (deg) around a point with a radius in meters. */
export function boundingBox(
  lat: number,
  lng: number,
  radiusMeters: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = (radiusMeters / EARTH_RADIUS_M) / DEG2RAD;
  const lngDelta = latDelta / Math.max(0.000001, Math.cos(lat * DEG2RAD));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

// ---------------------------------------------------------------------------
// Geofence monitor
// ---------------------------------------------------------------------------

export interface CapGeofence {
  id: string;
  latitude: number;
  longitude: number;
  /** Trigger radius in meters. */
  radiusMeters: number;
  /** Optional opaque payload echoed back in events. */
  data?: unknown;
}

export interface CapGeofenceEvent {
  fence: CapGeofence;
  position: CapPosition;
  /** Current distance to the fence center (m). */
  distanceMeters: number;
  type: 'enter' | 'exit';
}

/**
 * Watches the shared geolocation stream and fires enter/exit callbacks as the
 * device crosses circular geofences. Hysteresis (a small exit margin) avoids
 * flapping right at the boundary.
 *
 *   const gf = new CapGeofenceMonitor();
 *   gf.add({ id: 'library', latitude, longitude, radiusMeters: 80 });
 *   gf.onEnter((e) => toast(`Arrived: ${e.fence.id}`));
 *   await gf.start();
 */
export class CapGeofenceMonitor {
  private fences = new Map<string, CapGeofence>();
  private inside = new Set<string>();
  private enterCbs = new Set<(e: CapGeofenceEvent) => void>();
  private exitCbs = new Set<(e: CapGeofenceEvent) => void>();
  private offPosition: (() => void) | null = null;
  private stopWatch: (() => Promise<void>) | null = null;
  /** Exit margin (m) added to the radius to debounce boundary jitter. */
  exitMargin = 15;

  add(fence: CapGeofence): void {
    this.fences.set(fence.id, fence);
  }
  remove(id: string): void {
    this.fences.delete(id);
    this.inside.delete(id);
  }
  clear(): void {
    this.fences.clear();
    this.inside.clear();
  }
  list(): CapGeofence[] {
    return Array.from(this.fences.values());
  }
  isInside(id: string): boolean {
    return this.inside.has(id);
  }

  onEnter(cb: (e: CapGeofenceEvent) => void): () => void {
    this.enterCbs.add(cb);
    return () => this.enterCbs.delete(cb);
  }
  onExit(cb: (e: CapGeofenceEvent) => void): () => void {
    this.exitCbs.add(cb);
    return () => this.exitCbs.delete(cb);
  }

  /** Begin monitoring (starts the shared geo watch). */
  async start(options?: CapGeoOptions): Promise<void> {
    if (this.offPosition) return;
    this.offPosition = capGeo.on('position', (p) => this.evaluate(p));
    this.stopWatch = await capGeo.startWatch(options);
    const last = capGeo.getLastKnownPosition();
    if (last) this.evaluate(last);
  }

  /** Stop monitoring (does not stop other geo consumers' watches). */
  async stop(): Promise<void> {
    this.offPosition?.();
    this.offPosition = null;
    if (this.stopWatch) {
      await this.stopWatch();
      this.stopWatch = null;
    }
  }

  private evaluate(position: CapPosition): void {
    const { latitude, longitude } = position.coords;
    for (const fence of this.fences.values()) {
      const dist = haversineMeters(latitude, longitude, fence.latitude, fence.longitude);
      const within = dist <= fence.radiusMeters;
      const wasInside = this.inside.has(fence.id);
      if (within && !wasInside) {
        this.inside.add(fence.id);
        this.fire('enter', { fence, position, distanceMeters: dist, type: 'enter' });
      } else if (!within && wasInside && dist > fence.radiusMeters + this.exitMargin) {
        this.inside.delete(fence.id);
        this.fire('exit', { fence, position, distanceMeters: dist, type: 'exit' });
      }
    }
  }

  private fire(type: 'enter' | 'exit', e: CapGeofenceEvent): void {
    const set = type === 'enter' ? this.enterCbs : this.exitCbs;
    for (const cb of Array.from(set)) {
      try {
        cb(e);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[CapGeofence] callback error', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Extended React hooks
// ---------------------------------------------------------------------------

/** Live distance (m) from the device to a fixed target; null until first fix. */
export function useDistanceTo(target: { latitude: number; longitude: number } | null): number | null {
  const { position } = useGeolocation({ watch: true, immediate: true });
  if (!position || !target) return null;
  return haversineMeters(
    position.coords.latitude,
    position.coords.longitude,
    target.latitude,
    target.longitude,
  );
}

/** Mounts a geofence monitor for the given fences and reports enter/exit. */
export function useGeofences(
  fences: CapGeofence[],
  handlers: { onEnter?: (e: CapGeofenceEvent) => void; onExit?: (e: CapGeofenceEvent) => void },
): { inside: string[] } {
  const [inside, setInside] = useState<string[]>([]);
  const monitorRef = useRef<CapGeofenceMonitor | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const gf = new CapGeofenceMonitor();
    monitorRef.current = gf;
    const offEnter = gf.onEnter((e) => {
      setInside(gf.list().map((f) => f.id).filter((id) => gf.isInside(id)));
      handlersRef.current.onEnter?.(e);
    });
    const offExit = gf.onExit((e) => {
      setInside(gf.list().map((f) => f.id).filter((id) => gf.isInside(id)));
      handlersRef.current.onExit?.(e);
    });
    void gf.start();
    return () => {
      offEnter();
      offExit();
      void gf.stop();
      monitorRef.current = null;
    };
  }, []);

  // Keep the fence set in sync with the prop.
  useEffect(() => {
    const gf = monitorRef.current;
    if (!gf) return;
    gf.clear();
    fences.forEach((f) => gf.add(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(fences)]);

  return { inside };
}

export default capGeo;
