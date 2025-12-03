/**
 * OpenStreetMap Common Component
 * Common map component for all apps
 * Based on Leaflet.js with OpenStreetMap tiles, wrapped with WebView
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import type {
  OpenStreetMapConfig,
  MapMarker,
  MapPolyline,
  MapPolygon,
  MapCircle,
  MapEvent,
  OpenStreetMapRef,
} from '../types/openstreet-map';

export interface OpenStreetMapProps extends OpenStreetMapConfig {
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
 * Generate OpenStreetMap HTML content
 */
const generateMapHTML = (config: OpenStreetMapConfig): string => {
  const {
    centerLat = 39.908823,
    centerLng = 116.39747,
    zoom = 13,
    tileLayerUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    showZoomControl = true,
    showAttribution = true,
    draggable = true,
    scrollWheel = true,
    doubleClickZoom = true,
    minZoom = 0,
    maxZoom = 19,
  } = config;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OpenStreetMap</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    (function() {
      let map = null;
      let markers = {};
      let polylines = {};
      let polygons = {};
      let circles = {};

      // Initialize map
      function initMap() {
        map = L.map('mapContainer', {
          center: [${centerLat}, ${centerLng}],
          zoom: ${zoom},
          zoomControl: ${showZoomControl},
          dragging: ${draggable},
          scrollWheelZoom: ${scrollWheel},
          doubleClickZoom: ${doubleClickZoom},
          minZoom: ${minZoom},
          maxZoom: ${maxZoom},
        });

        // Add tile layer
        L.tileLayer('${tileLayerUrl}', {
          maxZoom: ${maxZoom},
          attribution: ${showAttribution} ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' : ''
        }).addTo(map);

        // Map loaded event
        map.on('load', function() {
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
              lat: e.latlng.lat,
              lng: e.latlng.lng
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
        map.on('zoomend', function() {
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
        const markerOptions = {
          title: marker.title || '',
        };

        if (marker.icon) {
          markerOptions.icon = L.icon({
            iconUrl: marker.icon,
            iconSize: [marker.iconWidth || 32, marker.iconHeight || 32],
            iconAnchor: [marker.iconWidth ? marker.iconWidth / 2 : 16, marker.iconHeight || 32],
            popupAnchor: [0, -(marker.iconHeight || 32)]
          });
        }

        const markerObj = L.marker([marker.lat, marker.lng], markerOptions).addTo(map);

        if (marker.popup) {
          markerObj.bindPopup(marker.popup);
        }

        // Marker click event
        markerObj.on('click', function() {
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
          map.removeLayer(markers[id]);
          delete markers[id];
        }
      }

      // Clear all markers
      function clearMarkers() {
        Object.keys(markers).forEach(function(id) {
          map.removeLayer(markers[id]);
        });
        markers = {};
      }

      // Add polyline
      function addPolyline(polyline) {
        const path = polyline.path.map(function(point) {
          return [point.lat, point.lng];
        });

        const polylineObj = L.polyline(path, {
          color: polyline.color || '#FF0000',
          weight: polyline.weight || 3,
          opacity: polyline.opacity !== undefined ? polyline.opacity : 1,
          dashArray: polyline.dashArray || null
        }).addTo(map);

        polylines[polyline.id] = polylineObj;
      }

      // Remove polyline
      function removePolyline(id) {
        if (polylines[id]) {
          map.removeLayer(polylines[id]);
          delete polylines[id];
        }
      }

      // Add polygon
      function addPolygon(polygon) {
        const path = polygon.path.map(function(point) {
          return [point.lat, point.lng];
        });

        const polygonObj = L.polygon(path, {
          fillColor: polygon.fillColor || '#FF0000',
          color: polygon.strokeColor || '#000000',
          weight: polygon.strokeWidth || 2,
          fillOpacity: polygon.fillOpacity !== undefined ? polygon.fillOpacity : 0.5,
          opacity: polygon.strokeOpacity !== undefined ? polygon.strokeOpacity : 1
        }).addTo(map);

        polygons[polygon.id] = polygonObj;
      }

      // Remove polygon
      function removePolygon(id) {
        if (polygons[id]) {
          map.removeLayer(polygons[id]);
          delete polygons[id];
        }
      }

      // Add circle
      function addCircle(circle) {
        const circleObj = L.circle([circle.centerLat, circle.centerLng], {
          radius: circle.radius,
          fillColor: circle.fillColor || '#FF0000',
          color: circle.strokeColor || '#000000',
          weight: circle.strokeWidth || 2,
          fillOpacity: circle.fillOpacity !== undefined ? circle.fillOpacity : 0.5,
          opacity: circle.strokeOpacity !== undefined ? circle.strokeOpacity : 1
        }).addTo(map);

        circles[circle.id] = circleObj;
      }

      // Remove circle
      function removeCircle(id) {
        if (circles[id]) {
          map.removeLayer(circles[id]);
          delete circles[id];
        }
      }

      // Clear all overlays
      function clearOverlays() {
        clearMarkers();
        Object.keys(polylines).forEach(function(id) {
          map.removeLayer(polylines[id]);
        });
        polylines = {};
        Object.keys(polygons).forEach(function(id) {
          map.removeLayer(polygons[id]);
        });
        polygons = {};
        Object.keys(circles).forEach(function(id) {
          map.removeLayer(circles[id]);
        });
        circles = {};
      }

      // Set map center point
      function setCenter(lat, lng) {
        if (map) {
          map.setView([lat, lng], map.getZoom());
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
          map.panTo([lat, lng]);
        }
      }

      // Fit bounds to contain all markers
      function fitBounds() {
        if (map && Object.keys(markers).length > 0) {
          const bounds = L.latLngBounds(
            Object.keys(markers).map(function(id) {
              const marker = markers[id];
              return marker.getLatLng();
            })
          );
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
      window.OpenStreetMapAPI = {
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
          } else if (message.type === 'getCenter') {
            getCenter();
          } else if (message.type === 'getZoom') {
            getZoom();
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
 * OpenStreetMap Component
 */
const OpenStreetMap = forwardRef<OpenStreetMapRef, OpenStreetMapProps>((props, ref) => {
  const webViewRef = useRef<WebView>(null);
  const {
    markers = [],
    polylines = [],
    polygons = [],
    circles = [],
    onEvent,
    style,
    height = SCREEN_HEIGHT,
    ...config
  } = props;

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

  // Add initial overlays after map loads
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Update when overlays change
  useEffect(() => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: 'clearOverlays',
        data: {},
      })
    );

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

  return (
    <View style={[styles.container, style, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML(config) }}
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

OpenStreetMap.displayName = 'OpenStreetMap';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
  },
});

export default OpenStreetMap;

