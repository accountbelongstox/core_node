# FREE OpenStreetMap Setup Guide

## ✅ What's Changed

Your React Native project now uses **100% FREE** mapping solution!

### Before (Paid):
- ❌ Required Google Maps API key
- ❌ Need Google Cloud account
- ❌ Billing setup required
- ❌ Usage limits

### After (FREE):
- ✅ **No API key needed**
- ✅ **No account required**
- ✅ **Unlimited usage**
- ✅ **Open source**

## 🗺️ Technology Stack

- **Map Library**: Leaflet (Web standard)
- **Map Tiles**: OpenStreetMap (FREE!)
- **Integration**: React Native WebView
- **Icon Library**: @react-native-vector-icons/feather

## 📦 Dependencies

```json
{
  "react-native-webview": "13.16.0",
  "@react-native-vector-icons/feather": "12.4.0"
}
```

## 🚀 How It Works

The app embeds a WebView that renders Leaflet map with OpenStreetMap tiles:

```
React Native App
  └── WebView Component
       └── HTML + Leaflet.js
            └── OpenStreetMap Tiles (FREE!)
```

## 📂 File Changes

### Modified Files:
1. **src/pages/MapHome.tsx** - Now uses WebView instead of react-native-maps
2. **android/app/src/main/AndroidManifest.xml** - Removed Google Maps API key
3. **react-native.config.js** - Removed react-native-maps configuration
4. **package.json** - Removed react-native-maps, added react-native-webview

### Removed:
- react-native-maps dependency
- Google Maps API key configuration
- MapHome.tsx.old (backup of old implementation)

## 🎨 Features

- ✅ Interactive map with zoom/pan
- ✅ Custom markers
- ✅ Popup information
- ✅ Two-way communication (React Native ↔ WebView)
- ✅ Dark mode support (via CSS)
- ✅ Touch gestures

## 🔧 Customization

### Change Map Style

Edit `src/pages/MapHome.tsx` line ~45:

```javascript
// Default OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')

// Dark mode (CartoDB)
L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png')

// Satellite (ESRI)
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
```

### Add Custom Markers

```javascript
// In the HTML section
const customIcon = L.icon({
  iconUrl: 'https://your-icon-url.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

L.marker([lat, lng], { icon: customIcon }).addTo(map);
```

## 💬 Communication

### Send data from WebView to React Native:

```javascript
// In WebView (JavaScript)
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'markerClick',
  data: { name: 'Location Name' }
}));
```

```typescript
// In React Native
const handleMessage = (event: any) => {
  const data = JSON.parse(event.nativeEvent.data);
  console.log('Received:', data);
};
```

## 📊 Performance

- **Initial Load**: ~1-2 seconds
- **Map Interaction**: Smooth (60fps)
- **Memory Usage**: ~60MB
- **Offline**: Requires internet connection

## 🐛 Troubleshooting

### Map not showing?
1. Check internet connection
2. Verify `javaScriptEnabled={true}` in WebView
3. Check console for errors

### Slow loading?
1. Use `startInLoadingState={true}`
2. Consider caching tiles (advanced)

### Can't interact with map?
1. Ensure `domStorageEnabled={true}`
2. Check touch events not blocked by overlays

## 🆚 Comparison

| Feature | react-native-maps | WebView + OSM |
|---------|-------------------|---------------|
| Cost | API key required | FREE |
| Setup | Complex | Simple |
| Performance | Native (faster) | Web (good) |
| Offline | Partial support | No |
| Customization | Limited | Full CSS/JS |
| File Size | +5MB | +1MB |

## 📚 Resources

- [OpenStreetMap](https://www.openstreetmap.org/)
- [Leaflet Documentation](https://leafletjs.com/)
- [React Native WebView](https://github.com/react-native-webview/react-native-webview)
- [Leaflet Providers](https://leaflet-extras.github.io/leaflet-providers/preview/)

## 🎯 Next Steps

1. Run the app: `npx react-native run-android`
2. Test map functionality
3. Customize markers and styles
4. Add more map features as needed

## ⚠️ Important Notes

- **No API limits** - Use freely!
- **Attribution required** - Keep "© OpenStreetMap" visible
- **Tile server fair use** - Don't abuse (normal app usage is fine)
- **Internet required** - Maps won't work offline (can be improved with caching)

Enjoy your FREE mapping solution! 🎉

---

## 🗺️ Tencent Map Common Library

### Overview

A common Tencent Map library for all apps in the multi-app architecture. This library provides a reusable map component and utility services based on Tencent Map JavaScript API 3.0, wrapped with React Native WebView.

### Location

All files are located in `src/common/`:

```
src/common/
├── components/
│   └── TencentMap.tsx          # Main map component
├── services/
│   └── tencent-map-service.ts  # Utility functions
├── types/
│   └── tencent-map.ts          # TypeScript type definitions
└── index.ts                    # Export file
```

### Features

- ✅ **Reusable across all apps** - Common library for multi-app architecture
- ✅ **Full TypeScript support** - Type-safe API
- ✅ **Rich map features** - Markers, polylines, polygons, circles
- ✅ **Event handling** - Click, move, zoom events
- ✅ **Utility functions** - Distance calculation, coordinate conversion, etc.
- ✅ **Ref-based control** - Programmatic map control

### Installation

No additional installation needed! The library is already part of the common layer.

### Basic Usage

```typescript
import { TencentMap, createMarker } from '../common';

function MyMapScreen() {
  const mapRef = useRef<TencentMapRef>(null);

  return (
    <TencentMap
      key="YOUR_TENCENT_MAP_KEY"
      centerLat={39.908823}
      centerLng={116.39747}
      zoom={13}
      markers={[
        createMarker('marker1', 39.908823, 116.39747, {
          title: 'Beijing',
          icon: 'https://example.com/icon.png',
        }),
      ]}
      onEvent={(event) => {
        if (event.type === 'markerClick') {
          console.log('Marker clicked:', event.data);
        }
      }}
      ref={mapRef}
    />
  );
}
```

### Configuration Options

```typescript
interface TencentMapConfig {
  key: string;                    // Required: Tencent Map API Key
  centerLat?: number;              // Map center latitude
  centerLng?: number;              // Map center longitude
  zoom?: number;                   // Zoom level (3-19)
  mapStyle?: 'normal' | 'dark' | 'light';  // Map style
  showZoomControl?: boolean;       // Show zoom controls
  showScale?: boolean;             // Show scale
  draggable?: boolean;             // Enable dragging
  scrollWheel?: boolean;           // Enable scroll wheel zoom
  doubleClickZoom?: boolean;       // Enable double click zoom
  minZoom?: number;                // Minimum zoom level
  maxZoom?: number;                // Maximum zoom level
}
```

### Programmatic Control

```typescript
const mapRef = useRef<TencentMapRef>(null);

// Set center point
mapRef.current?.setCenter(39.908823, 116.39747);

// Set zoom level
mapRef.current?.setZoom(15);

// Add marker
mapRef.current?.addMarker({
  id: 'new-marker',
  lat: 39.908823,
  lng: 116.39747,
  title: 'New Location',
});

// Remove marker
mapRef.current?.removeMarker('new-marker');

// Clear all overlays
mapRef.current?.clearOverlays();

// Get current center
const center = await mapRef.current?.getCenter();

// Pan to location
mapRef.current?.panTo(39.908823, 116.39747);

// Fit bounds to show all markers
mapRef.current?.fitBounds();
```

### Utility Functions

```typescript
import {
  calculateDistance,
  calculateCenter,
  calculateBounds,
  formatDistance,
  isValidCoordinate,
  wgs84ToGcj02,
  createMarker,
  createPolyline,
  createPolygon,
  createCircle,
} from '../common';

// Calculate distance between two points (in meters)
const distance = calculateDistance(lat1, lng1, lat2, lng2);

// Calculate center of multiple points
const center = calculateCenter([
  { lat: 39.9, lng: 116.4 },
  { lat: 39.91, lng: 116.41 },
]);

// Format distance display
const formatted = formatDistance(1500); // "1.5km"

// Validate coordinates
if (isValidCoordinate(lat, lng)) {
  // Use coordinates
}

// Convert WGS84 to GCJ02 (Tencent Map uses GCJ02)
const gcj02 = wgs84ToGcj02(wgs84Lat, wgs84Lng);

// Create overlay objects
const marker = createMarker('id', lat, lng, { title: 'Location' });
const polyline = createPolyline('id', path, { color: '#FF0000' });
const polygon = createPolygon('id', path, { fillColor: '#00FF00' });
const circle = createCircle('id', centerLat, centerLng, radius);
```

### Map Overlays

#### Markers

```typescript
const markers: MapMarker[] = [
  {
    id: 'marker1',
    lat: 39.908823,
    lng: 116.39747,
    title: 'Location Name',
    icon: 'https://example.com/icon.png',
    iconWidth: 32,
    iconHeight: 32,
    data: { custom: 'data' },
  },
];
```

#### Polylines

```typescript
const polylines: MapPolyline[] = [
  {
    id: 'route1',
    path: [
      { lat: 39.9, lng: 116.4 },
      { lat: 39.91, lng: 116.41 },
    ],
    color: '#FF0000',
    width: 3,
    opacity: 0.8,
    borderDash: false,
  },
];
```

#### Polygons

```typescript
const polygons: MapPolygon[] = [
  {
    id: 'area1',
    path: [
      { lat: 39.9, lng: 116.4 },
      { lat: 39.91, lng: 116.4 },
      { lat: 39.91, lng: 116.41 },
      { lat: 39.9, lng: 116.41 },
    ],
    fillColor: '#00FF00',
    strokeColor: '#000000',
    strokeWidth: 2,
    fillOpacity: 0.5,
  },
];
```

#### Circles

```typescript
const circles: MapCircle[] = [
  {
    id: 'circle1',
    centerLat: 39.908823,
    centerLng: 116.39747,
    radius: 1000, // meters
    fillColor: '#0000FF',
    strokeColor: '#000000',
    strokeWidth: 2,
    fillOpacity: 0.3,
  },
];
```

### Event Handling

```typescript
<TencentMap
  onEvent={(event) => {
    switch (event.type) {
      case 'markerClick':
        console.log('Marker clicked:', event.data);
        break;
      case 'mapClick':
        console.log('Map clicked at:', event.data);
        break;
      case 'mapMoveEnd':
        console.log('Map moved to:', event.data);
        break;
      case 'zoomChange':
        console.log('Zoom changed to:', event.data.zoom);
        break;
    }
  }}
/>
```

### API Key Setup

1. Get your Tencent Map API Key from [Tencent Location Service](https://lbs.qq.com/)
2. Add the key to your app configuration or environment variables
3. Pass the key to the `TencentMap` component

```typescript
// Option 1: Direct in component
<TencentMap key="YOUR_API_KEY" ... />

// Option 2: From config
import { getAppConfig } from '../config';
<TencentMap key={getAppConfig().tencentMapKey} ... />
```

### Coordinate System

Tencent Map uses **GCJ02** coordinate system (Mars coordinate system). If your coordinates are in WGS84, use the conversion function:

```typescript
import { wgs84ToGcj02 } from '../common';

const wgs84Coords = { lat: 39.908823, lng: 116.39747 };
const gcj02Coords = wgs84ToGcj02(wgs84Coords.lat, wgs84Coords.lng);
```

### Best Practices

1. **Reuse the common library** - Always import from `../common` instead of creating app-specific map code
2. **Use utility functions** - Leverage `createMarker`, `calculateDistance`, etc.
3. **Handle events properly** - Use the `onEvent` callback for user interactions
4. **Manage API keys securely** - Store keys in environment variables or secure config
5. **Type safety** - Use TypeScript types for all map objects

### Troubleshooting

**Map not loading?**
- Check if API key is valid
- Verify internet connection
- Check browser console for errors

**Coordinates incorrect?**
- Ensure coordinates are in GCJ02 format
- Use `wgs84ToGcj02` if converting from WGS84

**Events not firing?**
- Verify `onEvent` prop is passed
- Check event type matches expected values

### Resources

- [Tencent Map JavaScript API Documentation](https://lbs.qq.com/webApi/javascriptGL/glGuide/glOverview)
- [Tencent Location Service](https://lbs.qq.com/)
- Common library source: `src/common/`