/**
 * Tencent Map Service
 * Provides map-related utility methods and API encapsulation
 * Common service for all apps
 */

import type {
  MapMarker,
  MapPolyline,
  MapPolygon,
  MapCircle,
} from '../types/tencent-map';

/**
 * Calculate distance between two points (in meters)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate center point of multiple points
 */
export function calculateCenter(
  points: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } {
  if (points.length === 0) {
    return { lat: 0, lng: 0 };
  }

  let totalLat = 0;
  let totalLng = 0;

  points.forEach((point) => {
    totalLat += point.lat;
    totalLng += point.lng;
  });

  return {
    lat: totalLat / points.length,
    lng: totalLng / points.length,
  };
}

/**
 * Calculate bounding box containing all points
 */
export function calculateBounds(
  points: Array<{ lat: number; lng: number }>
): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  if (points.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  let north = points[0].lat;
  let south = points[0].lat;
  let east = points[0].lng;
  let west = points[0].lng;

  points.forEach((point) => {
    if (point.lat > north) north = point.lat;
    if (point.lat < south) south = point.lat;
    if (point.lng > east) east = point.lng;
    if (point.lng < west) west = point.lng;
  });

  return { north, south, east, west };
}

/**
 * Calculate appropriate zoom level based on distance
 */
export function calculateZoomByDistance(distance: number): number {
  // Calculate appropriate zoom level based on distance (in meters)
  // This formula is empirical and can be adjusted as needed
  if (distance < 100) return 18;
  if (distance < 500) return 16;
  if (distance < 1000) return 15;
  if (distance < 5000) return 13;
  if (distance < 10000) return 12;
  if (distance < 50000) return 10;
  if (distance < 100000) return 9;
  return 8;
}

/**
 * Validate if coordinates are valid
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Format distance display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else if (meters < 10000) {
    return `${(meters / 1000).toFixed(1)}km`;
  } else {
    return `${Math.round(meters / 1000)}km`;
  }
}

/**
 * Create marker
 */
export function createMarker(
  id: string,
  lat: number,
  lng: number,
  options?: Partial<MapMarker>
): MapMarker {
  return {
    id,
    lat,
    lng,
    ...options,
  };
}

/**
 * Create polyline
 */
export function createPolyline(
  id: string,
  path: Array<{ lat: number; lng: number }>,
  options?: Partial<MapPolyline>
): MapPolyline {
  return {
    id,
    path,
    color: '#FF0000',
    width: 3,
    opacity: 1,
    ...options,
  };
}

/**
 * Create polygon
 */
export function createPolygon(
  id: string,
  path: Array<{ lat: number; lng: number }>,
  options?: Partial<MapPolygon>
): MapPolygon {
  return {
    id,
    path,
    fillColor: '#FF0000',
    strokeColor: '#000000',
    strokeWidth: 2,
    fillOpacity: 0.5,
    strokeOpacity: 1,
    ...options,
  };
}

/**
 * Create circle
 */
export function createCircle(
  id: string,
  centerLat: number,
  centerLng: number,
  radius: number,
  options?: Partial<MapCircle>
): MapCircle {
  return {
    id,
    centerLat,
    centerLng,
    radius,
    fillColor: '#FF0000',
    strokeColor: '#000000',
    strokeWidth: 2,
    fillOpacity: 0.5,
    strokeOpacity: 1,
    ...options,
  };
}

/**
 * Coordinate conversion: WGS84 to GCJ02 (Tencent Map uses GCJ02 coordinate system)
 * Note: This is a simplified conversion, professional coordinate conversion library is recommended in production
 */
export function wgs84ToGcj02(wgsLat: number, wgsLng: number): {
  lat: number;
  lng: number;
} {
  const a = 6378245.0;
  const ee = 0.00669342162296594323;

  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = (wgsLat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);

  return {
    lat: wgsLat + dLat,
    lng: wgsLng + dLng,
  };
}

function transformLat(lng: number, lat: number): number {
  let ret =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng));
  ret +=
    ((20.0 * Math.sin(6.0 * lng * Math.PI) +
      20.0 * Math.sin(2.0 * lng * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(lat * Math.PI) +
      40.0 * Math.sin((lat / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((160.0 * Math.sin((lat / 12.0) * Math.PI) +
      320 * Math.sin((lat * Math.PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
}

function transformLng(lng: number, lat: number): number {
  let ret =
    300.0 +
    lng +
    2.0 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng));
  ret +=
    ((20.0 * Math.sin(6.0 * lng * Math.PI) +
      20.0 * Math.sin(2.0 * lng * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(lng * Math.PI) +
      40.0 * Math.sin((lng / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((150.0 * Math.sin((lng / 12.0) * Math.PI) +
      300.0 * Math.sin((lng / 30.0) * Math.PI)) *
      2.0) /
    3.0;
  return ret;
}

