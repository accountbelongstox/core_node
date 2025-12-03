/**
 * Common Library Index
 * Export all common components, services, and types for all apps
 */

// Tencent Map exports
export { default as TencentMap } from './components/TencentMap';
export type { TencentMapProps } from './components/TencentMap';
export type {
  TencentMapConfig,
  MapMarker as TencentMapMarker,
  MapPolyline as TencentMapPolyline,
  MapPolygon as TencentMapPolygon,
  MapCircle as TencentMapCircle,
  MapEvent as TencentMapEvent,
  TencentMapRef,
} from './types/tencent-map';
export * from './services/tencent-map-service';

// OpenStreetMap exports
export { default as OpenStreetMap } from './components/OpenStreetMap';
export type { OpenStreetMapProps } from './components/OpenStreetMap';

// Re-export OpenStreetMapProps for convenience
export type { OpenStreetMapProps as OpenStreetMapComponentProps } from './components/OpenStreetMap';
export type {
  OpenStreetMapConfig,
  MapMarker,
  MapPolyline,
  MapPolygon,
  MapCircle,
  MapEvent,
  OpenStreetMapRef,
} from './types/openstreet-map';
export * from './services/openstreet-map-service';

