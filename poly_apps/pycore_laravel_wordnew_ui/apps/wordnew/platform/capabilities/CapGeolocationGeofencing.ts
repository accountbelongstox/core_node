/** Geodesy helpers, geofencing, and related React hooks. */
import { useEffect, useRef, useState } from 'react';
import { capGeo, haversineMeters, useGeolocation } from './CapGeolocationCore';
import type { CapCoords, CapGeoOptions, CapPosition } from './CapGeolocationCore';
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

