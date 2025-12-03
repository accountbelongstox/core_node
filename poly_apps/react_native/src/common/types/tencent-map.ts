/**
 * Tencent Map Common Library Type Definitions
 * Common types for all apps
 */

export interface TencentMapConfig {
  /** Tencent Map API Key */
  key: string;
  /** Map center latitude */
  centerLat?: number;
  /** Map center longitude */
  centerLng?: number;
  /** Map zoom level (3-19) */
  zoom?: number;
  /** Map style (normal: normal, dark: dark, light: light) */
  mapStyle?: 'normal' | 'dark' | 'light';
  /** Show zoom control */
  showZoomControl?: boolean;
  /** Show scale */
  showScale?: boolean;
  /** Enable dragging */
  draggable?: boolean;
  /** Enable scroll wheel zoom */
  scrollWheel?: boolean;
  /** Enable double click zoom */
  doubleClickZoom?: boolean;
  /** Minimum zoom level */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
}

export interface MapMarker {
  /** Marker ID */
  id: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Title */
  title?: string;
  /** Icon URL or path */
  icon?: string;
  /** Icon width */
  iconWidth?: number;
  /** Icon height */
  iconHeight?: number;
  /** Custom data */
  data?: any;
}

export interface MapPolyline {
  /** Polyline ID */
  id: string;
  /** Path points array */
  path: Array<{ lat: number; lng: number }>;
  /** Line color (hexadecimal, e.g. #FF0000) */
  color?: string;
  /** Line width (pixels) */
  width?: number;
  /** Is dashed line */
  borderDash?: boolean;
  /** Line opacity (0-1) */
  opacity?: number;
}

export interface MapPolygon {
  /** Polygon ID */
  id: string;
  /** Path points array */
  path: Array<{ lat: number; lng: number }>;
  /** Fill color */
  fillColor?: string;
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Fill opacity (0-1) */
  fillOpacity?: number;
  /** Stroke opacity (0-1) */
  strokeOpacity?: number;
}

export interface MapCircle {
  /** Circle ID */
  id: string;
  /** Center latitude */
  centerLat: number;
  /** Center longitude */
  centerLng: number;
  /** Radius (meters) */
  radius: number;
  /** Fill color */
  fillColor?: string;
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Fill opacity (0-1) */
  fillOpacity?: number;
  /** Stroke opacity (0-1) */
  strokeOpacity?: number;
}

export interface MapEvent {
  /** Event type */
  type: 'markerClick' | 'markerDragEnd' | 'mapClick' | 'mapMoveEnd' | 'zoomChange';
  /** Event data */
  data: any;
}

export interface TencentMapRef {
  /** Set map center point */
  setCenter: (lat: number, lng: number) => void;
  /** Set map zoom level */
  setZoom: (zoom: number) => void;
  /** Add marker */
  addMarker: (marker: MapMarker) => void;
  /** Remove marker */
  removeMarker: (id: string) => void;
  /** Clear all markers */
  clearMarkers: () => void;
  /** Add polyline */
  addPolyline: (polyline: MapPolyline) => void;
  /** Remove polyline */
  removePolyline: (id: string) => void;
  /** Add polygon */
  addPolygon: (polygon: MapPolygon) => void;
  /** Remove polygon */
  removePolygon: (id: string) => void;
  /** Add circle */
  addCircle: (circle: MapCircle) => void;
  /** Remove circle */
  removeCircle: (id: string) => void;
  /** Clear all overlays */
  clearOverlays: () => void;
  /** Get current map center point */
  getCenter: () => Promise<{ lat: number; lng: number }>;
  /** Get current zoom level */
  getZoom: () => Promise<number>;
  /** Pan to specified coordinates */
  panTo: (lat: number, lng: number) => void;
  /** Fit bounds to contain all markers */
  fitBounds: () => void;
}

