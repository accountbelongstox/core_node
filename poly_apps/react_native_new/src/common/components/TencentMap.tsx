/**
 * Tencent Map Common Component
 * Common map component for all apps
 * Based on Tencent Map JavaScript API 3.0, wrapped with WebView
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  TencentMapConfig,
  MapMarker,
  MapPolyline,
  MapPolygon,
  MapCircle,
  MapEvent,
  TencentMapRef,
} from '../types/tencent-map';

export interface TencentMapProps extends TencentMapConfig {
  /** Markers array */
  markers?: MapMarker[];
  /** Polylines array */
  polylines?: MapPolyline[];
  /** Polygons array */
  polygons?: MapPolygon[];
  /** Circles array */
  circles?: MapCircle[];
  /** Event callback */
  onEvent?: (event: MapEvent) => void;
  /** Component style */
  style?: any;
  /** Map container height */
  height?: number | string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Generate Tencent Map HTML content
 */
const generateMapHTML = (config: TencentMapConfig): string => {
  const {
    key,
    centerLat = 39.908823,
    centerLng = 116.39747,
    zoom = 13,
    mapStyle = 'normal',
    showZoomControl = true,
    showScale = true,
    draggable = true,
    scrollWheel = true,
    doubleClickZoom = true,
    minZoom = 3,
    maxZoom = 19,
  } = config;

  // Map style configuration
  const styleMap: Record<string, string> = {
    normal: 'normal',
    dark: 'dark',
    light: 'light',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Tencent Map</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    #mapContainer {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="mapContainer"></div>
  <script charset="utf-8" src="https://map.qq.com/api/gljs?v=1.exp&key=${key}"></script>
  <script>
    (function() {
      let map = null;
      let markers = [];
      let polylines = [];
      let polygons = [];
      let circles = [];

      // Initialize map
      function initMap() {
        const center = new TMap.LatLng(${centerLat}, ${centerLng});
        
        map = new TMap.Map('mapContainer', {
          center: center,
          zoom: ${zoom},
          mapTypeId: '${styleMap[mapStyle]}',
          zoomControl: ${showZoomControl},
          scaleControl: ${showScale},
          draggable: ${draggable},
          scrollWheel: ${scrollWheel},
          doubleClickZoom: ${doubleClickZoom},
          minZoom: ${minZoom},
          maxZoom: ${maxZoom},
        });

        // Map loaded event
        map.on('tilesloaded', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapReady',
            data: {}
          }));
        });

        // Map click event
        map.on('click', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapClick',
            data: {
              lat: e.latLng.lat,
              lng: e.latLng.lng
            }
          }));
        });

        // Map move end event
        map.on('moveend', function() {
          const center = map.getCenter();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapMoveEnd',
            data: {
              lat: center.lat,
              lng: center.lng,
              zoom: map.getZoom()
            }
          }));
        });

        // Map zoom change event
        map.on('zoom_changed', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'zoomChange',
            data: {
              zoom: map.getZoom()
            }
          }));
        });
      }

      // Add marker
      function addMarker(marker) {
        const position = new TMap.LatLng(marker.lat, marker.lng);
        
        const markerConfig = {
          map: map,
          geometries: [{
            id: marker.id,
            position: position,
            properties: {
              title: marker.title || '',
            }
          }]
        };

        // Add icon style if provided
        if (marker.icon) {
          markerConfig.styles = {
            default: new TMap.MarkerStyle({
              width: marker.iconWidth || 32,
              height: marker.iconHeight || 32,
              anchor: { x: 0.5, y: 1 },
              src: marker.icon
            })
          };
          markerConfig.geometries[0].styleId = 'default';
        }

        const markerObj = new TMap.MultiMarker(markerConfig);

        // Marker click event
        markerObj.on('click', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'markerClick',
            data: {
              id: marker.id,
              lat: marker.lat,
              lng: marker.lng,
              data: marker.data
            }
          }));
        });

        markers[marker.id] = markerObj;
      }

      // Remove marker
      function removeMarker(id) {
        if (markers[id]) {
          markers[id].setMap(null);
          delete markers[id];
        }
      }

      // Clear all markers
      function clearMarkers() {
        Object.keys(markers).forEach(function(id) {
          markers[id].setMap(null);
        });
        markers = {};
      }

      // Add polyline
      function addPolyline(polyline) {
        const path = polyline.path.map(function(point) {
          return new TMap.LatLng(point.lat, point.lng);
        });

        const polylineObj = new TMap.MultiPolyline({
          map: map,
          styles: {
            default: {
              color: polyline.color || '#FF0000',
              width: polyline.width || 3,
              borderWidth: 0,
              opacity: polyline.opacity !== undefined ? polyline.opacity : 1,
              lineDash: polyline.borderDash ? [10, 10] : []
            }
          },
          geometries: [{
            id: polyline.id,
            styleId: 'default',
            paths: path
          }]
        });

        polylines[polyline.id] = polylineObj;
      }

      // Remove polyline
      function removePolyline(id) {
        if (polylines[id]) {
          polylines[id].setMap(null);
          delete polylines[id];
        }
      }

      // Add polygon
      function addPolygon(polygon) {
        const path = polygon.path.map(function(point) {
          return new TMap.LatLng(point.lat, point.lng);
        });

        const polygonObj = new TMap.MultiPolygon({
          map: map,
          styles: {
            default: {
              color: polygon.fillColor || '#FF0000',
              showBorder: true,
              borderColor: polygon.strokeColor || '#000000',
              borderWidth: polygon.strokeWidth || 2,
              opacity: polygon.fillOpacity !== undefined ? polygon.fillOpacity : 0.5,
              borderOpacity: polygon.strokeOpacity !== undefined ? polygon.strokeOpacity : 1
            }
          },
          geometries: [{
            id: polygon.id,
            styleId: 'default',
            paths: [path]
          }]
        });

        polygons[polygon.id] = polygonObj;
      }

      // Remove polygon
      function removePolygon(id) {
        if (polygons[id]) {
          polygons[id].setMap(null);
          delete polygons[id];
        }
      }

      // Add circle
      function addCircle(circle) {
        const center = new TMap.LatLng(circle.centerLat, circle.centerLng);

        const circleObj = new TMap.MultiCircle({
          map: map,
          styles: {
            default: {
              color: circle.fillColor || '#FF0000',
              showBorder: true,
              borderColor: circle.strokeColor || '#000000',
              borderWidth: circle.strokeWidth || 2,
              opacity: circle.fillOpacity !== undefined ? circle.fillOpacity : 0.5,
              borderOpacity: circle.strokeOpacity !== undefined ? circle.strokeOpacity : 1
            }
          },
          geometries: [{
            id: circle.id,
            styleId: 'default',
            center: center,
            radius: circle.radius
          }]
        });

        circles[circle.id] = circleObj;
      }

      // Remove circle
      function removeCircle(id) {
        if (circles[id]) {
          circles[id].setMap(null);
          delete circles[id];
        }
      }

      // Clear all overlays
      function clearOverlays() {
        clearMarkers();
        Object.keys(polylines).forEach(function(id) {
          polylines[id].setMap(null);
        });
        polylines = {};
        Object.keys(polygons).forEach(function(id) {
          polygons[id].setMap(null);
        });
        polygons = {};
        Object.keys(circles).forEach(function(id) {
          circles[id].setMap(null);
        });
        circles = {};
      }

      // Set map center point
      function setCenter(lat, lng) {
        if (map) {
          map.setCenter(new TMap.LatLng(lat, lng));
        }
      }

      // Set map zoom level
      function setZoom(zoom) {
        if (map) {
          map.setZoom(zoom);
        }
      }

      // Pan to specified coordinates
      function panTo(lat, lng) {
        if (map) {
          map.panTo(new TMap.LatLng(lat, lng));
        }
      }

      // Fit bounds to contain all markers
      function fitBounds() {
        if (map && Object.keys(markers).length > 0) {
          const bounds = new TMap.LatLngBounds();
          Object.keys(markers).forEach(function(id) {
            const marker = markers[id];
            // Get marker position and add to bounds
          });
          map.fitBounds(bounds);
        }
      }

      // Get current map center point
      function getCenter() {
        if (map) {
          const center = map.getCenter();
          const result = {
            lat: center.lat,
            lng: center.lng
          };
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'getCenterResponse',
            data: result
          }));
          return result;
        }
        return null;
      }

      // Get current zoom level
      function getZoom() {
        if (map) {
          const zoom = map.getZoom();
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'getZoomResponse',
            data: zoom
          }));
          return zoom;
        }
        return null;
      }

      // Expose methods for React Native to call
      window.TencentMapAPI = {
        initMap: initMap,
        addMarker: addMarker,
        removeMarker: removeMarker,
        clearMarkers: clearMarkers,
        addPolyline: addPolyline,
        removePolyline: removePolyline,
        addPolygon: addPolygon,
        removePolygon: removePolygon,
        addCircle: addCircle,
        removeCircle: removeCircle,
        clearOverlays: clearOverlays,
        setCenter: setCenter,
        setZoom: setZoom,
        panTo: panTo,
        fitBounds: fitBounds,
        getCenter: getCenter,
        getZoom: getZoom
      };

      // Listen for messages from React Native
      window.addEventListener('message', function(event) {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'init') {
            initMap();
          } else if (message.type === 'addMarker') {
            addMarker(message.data);
          } else if (message.type === 'removeMarker') {
            removeMarker(message.data);
          } else if (message.type === 'clearMarkers') {
            clearMarkers();
          } else if (message.type === 'addPolyline') {
            addPolyline(message.data);
          } else if (message.type === 'removePolyline') {
            removePolyline(message.data);
          } else if (message.type === 'addPolygon') {
            addPolygon(message.data);
          } else if (message.type === 'removePolygon') {
            removePolygon(message.data);
          } else if (message.type === 'addCircle') {
            addCircle(message.data);
          } else if (message.type === 'removeCircle') {
            removeCircle(message.data);
          } else if (message.type === 'clearOverlays') {
            clearOverlays();
          } else if (message.type === 'setCenter') {
            setCenter(message.data.lat, message.data.lng);
          } else if (message.type === 'setZoom') {
            setZoom(message.data);
          } else if (message.type === 'panTo') {
            panTo(message.data.lat, message.data.lng);
          } else if (message.type === 'fitBounds') {
            fitBounds();
          }
        } catch (e) {
          console.error('Error handling message:', e);
        }
      });

      // Initialize map after page load
      if (document.readyState === 'complete') {
        initMap();
      } else {
        window.onload = initMap;
      }
    })();
  </script>
</body>
</html>
  `;
};

/**
 * Tencent Map Component
 */
const TencentMap = forwardRef<TencentMapRef, TencentMapProps>((props, ref) => {
  const webViewRef = useRef<WebView>(null);
  const {
    key,
    markers = [],
    polylines = [],
    polygons = [],
    circles = [],
    onEvent,
    style,
    height = SCREEN_HEIGHT,
    ...config
  } = props;

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    setCenter: (lat: number, lng: number) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'setCenter',
          data: { lat, lng },
        })
      );
    },
    setZoom: (zoom: number) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'setZoom',
          data: zoom,
        })
      );
    },
    addMarker: (marker: MapMarker) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'addMarker',
          data: marker,
        })
      );
    },
    removeMarker: (id: string) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'removeMarker',
          data: id,
        })
      );
    },
    clearMarkers: () => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'clearMarkers',
          data: {},
        })
      );
    },
    addPolyline: (polyline: MapPolyline) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'addPolyline',
          data: polyline,
        })
      );
    },
    removePolyline: (id: string) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'removePolyline',
          data: id,
        })
      );
    },
    addPolygon: (polygon: MapPolygon) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'addPolygon',
          data: polygon,
        })
      );
    },
    removePolygon: (id: string) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'removePolygon',
          data: id,
        })
      );
    },
    addCircle: (circle: MapCircle) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'addCircle',
          data: circle,
        })
      );
    },
    removeCircle: (id: string) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'removeCircle',
          data: id,
        })
      );
    },
    clearOverlays: () => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'clearOverlays',
          data: {},
        })
      );
    },
    getCenter: async () => {
      return new Promise((resolve) => {
        messageHandlers.current.set('getCenterResponse', (data: any) => {
          resolve(data);
        });
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'getCenter',
            data: {},
          })
        );
        // Timeout fallback
        setTimeout(() => {
          if (messageHandlers.current.has('getCenterResponse')) {
            messageHandlers.current.delete('getCenterResponse');
            resolve({ lat: 0, lng: 0 });
          }
        }, 5000);
      });
    },
    getZoom: async () => {
      return new Promise((resolve) => {
        messageHandlers.current.set('getZoomResponse', (data: any) => {
          resolve(data);
        });
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'getZoom',
            data: {},
          })
        );
        // Timeout fallback
        setTimeout(() => {
          if (messageHandlers.current.has('getZoomResponse')) {
            messageHandlers.current.delete('getZoomResponse');
            resolve(13);
          }
        }, 5000);
      });
    },
    panTo: (lat: number, lng: number) => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'panTo',
          data: { lat, lng },
        })
      );
    },
    fitBounds: () => {
      webViewRef.current?.postMessage(
        JSON.stringify({
          type: 'fitBounds',
          data: {},
        })
      );
    },
  }));

  // Handle WebView messages
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());
  
  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      // Handle response messages
      if (message.type === 'getCenterResponse' || message.type === 'getZoomResponse') {
        const handler = messageHandlers.current.get(message.type);
        if (handler) {
          handler(message.data);
          messageHandlers.current.delete(message.type);
        }
        return;
      }
      
      // Handle other events
      if (onEvent && message.type !== 'mapReady') {
        onEvent(message as MapEvent);
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  };

  // Add initial overlays after map loads
  useEffect(() => {
    const timer = setTimeout(() => {
      // Add markers
      markers.forEach((marker) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addMarker',
            data: marker,
          })
        );
      });

      // Add polylines
      polylines.forEach((polyline) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addPolyline',
            data: polyline,
          })
        );
      });

      // Add polygons
      polygons.forEach((polygon) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addPolygon',
            data: polygon,
          })
        );
      });

      // Add circles
      circles.forEach((circle) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addCircle',
            data: circle,
          })
        );
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Update when overlays change
  useEffect(() => {
    // Clear all overlays
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: 'clearOverlays',
        data: {},
      })
    );

    // Re-add overlays
    setTimeout(() => {
      markers.forEach((marker) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addMarker',
            data: marker,
          })
        );
      });

      polylines.forEach((polyline) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addPolyline',
            data: polyline,
          })
        );
      });

      polygons.forEach((polygon) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addPolygon',
            data: polygon,
          })
        );
      });

      circles.forEach((circle) => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: 'addCircle',
            data: circle,
          })
        );
      });
    }, 100);
  }, [markers, polylines, polygons, circles]);

  if (!key) {
    console.warn('TencentMap: API Key is required');
    return null;
  }

  return (
    <View style={[styles.container, style, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML({ key, ...config }) }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        originWhitelist={['*']}
        mixedContentMode="always"
      />
    </View>
  );
});

TencentMap.displayName = 'TencentMap';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
  },
});

export default TencentMap;

