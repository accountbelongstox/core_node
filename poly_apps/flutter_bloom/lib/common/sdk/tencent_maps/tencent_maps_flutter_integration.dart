import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'tencent_maps_config.dart';
import 'tencent_maps_service.dart';

class TencentMapMarker {
  final String id;
  final double latitude;
  final double longitude;
  final String? title;
  final String? snippet;
  final Widget? icon;
  final VoidCallback? onTap;

  const TencentMapMarker({
    required this.id,
    required this.latitude,
    required this.longitude,
    this.title,
    this.snippet,
    this.icon,
    this.onTap,
  });

  TencentMapMarker copyWith({
    String? id,
    double? latitude,
    double? longitude,
    String? title,
    String? snippet,
    Widget? icon,
    VoidCallback? onTap,
  }) {
    return TencentMapMarker(
      id: id ?? this.id,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      title: title ?? this.title,
      snippet: snippet ?? this.snippet,
      icon: icon ?? this.icon,
      onTap: onTap ?? this.onTap,
    );
  }
}

class TencentMapController {
  final TencentMapsService _service;
  final ValueNotifier<double> _zoomLevel;
  final ValueNotifier<TencentMapStyle> _mapStyle;
  final ValueNotifier<double> _latitude;
  final ValueNotifier<double> _longitude;
  final ValueNotifier<List<TencentMapMarker>> _markers;
  final ValueNotifier<bool> _isLoading;

  TencentMapController({
    TencentMapsService? service,
    double? initialZoom,
    TencentMapStyle? initialStyle,
    double? initialLatitude,
    double? initialLongitude,
  })  : _service = service ?? TencentMapsService(),
        _zoomLevel = ValueNotifier(initialZoom ?? TencentMapsConfig.defaultZoom),
        _mapStyle = ValueNotifier(initialStyle ?? TencentMapStyle.normal),
        _latitude = ValueNotifier(initialLatitude ?? TencentMapsConfig.defaultLatitude),
        _longitude = ValueNotifier(initialLongitude ?? TencentMapsConfig.defaultLongitude),
        _markers = ValueNotifier([]),
        _isLoading = ValueNotifier(false);

  TencentMapsService get service => _service;
  ValueNotifier<double> get zoomLevel => _zoomLevel;
  ValueNotifier<TencentMapStyle> get mapStyle => _mapStyle;
  ValueNotifier<double> get latitude => _latitude;
  ValueNotifier<double> get longitude => _longitude;
  ValueNotifier<List<TencentMapMarker>> get markers => _markers;
  ValueNotifier<bool> get isLoading => _isLoading;

  void setZoom(double zoom) {
    if (zoom >= TencentMapsConfig.minZoom && zoom <= TencentMapsConfig.maxZoom) {
      _zoomLevel.value = zoom;
    }
  }

  void zoomIn() {
    if (_zoomLevel.value < TencentMapsConfig.maxZoom) {
      _zoomLevel.value += 1;
    }
  }

  void zoomOut() {
    if (_zoomLevel.value > TencentMapsConfig.minZoom) {
      _zoomLevel.value -= 1;
    }
  }

  void setMapStyle(TencentMapStyle style) {
    _mapStyle.value = style;
  }

  void setCenter(double latitude, double longitude) {
    _latitude.value = latitude;
    _longitude.value = longitude;
  }

  void animateCamera({
    required double latitude,
    required double longitude,
    double? zoom,
  }) {
    _latitude.value = latitude;
    _longitude.value = longitude;
    if (zoom != null) {
      setZoom(zoom);
    }
  }

  void addMarker(TencentMapMarker marker) {
    final currentMarkers = List<TencentMapMarker>.from(_markers.value);
    final existingIndex = currentMarkers.indexWhere((m) => m.id == marker.id);

    if (existingIndex >= 0) {
      currentMarkers[existingIndex] = marker;
    } else {
      currentMarkers.add(marker);
    }

    _markers.value = currentMarkers;
  }

  void removeMarker(String markerId) {
    final currentMarkers = List<TencentMapMarker>.from(_markers.value);
    currentMarkers.removeWhere((m) => m.id == markerId);
    _markers.value = currentMarkers;
  }

  void clearMarkers() {
    _markers.value = [];
  }

  void setMarkers(List<TencentMapMarker> markers) {
    _markers.value = markers;
  }

  void setLoading(bool loading) {
    _isLoading.value = loading;
  }

  void dispose() {
    _zoomLevel.dispose();
    _mapStyle.dispose();
    _latitude.dispose();
    _longitude.dispose();
    _markers.dispose();
    _isLoading.dispose();
  }
}

class TencentMapWidget extends StatefulWidget {
  final TencentMapController controller;
  final Function(double latitude, double longitude)? onTap;
  final Function(double latitude, double longitude)? onLongPress;
  final Function(double latitude, double longitude)? onCameraMove;
  final VoidCallback? onCameraIdle;
  final bool showMyLocation;
  final bool showCompass;
  final bool showScale;
  final bool enableZoomControls;
  final bool enableRotation;
  final bool enableScrolling;

  const TencentMapWidget({
    super.key,
    required this.controller,
    this.onTap,
    this.onLongPress,
    this.onCameraMove,
    this.onCameraIdle,
    this.showMyLocation = true,
    this.showCompass = true,
    this.showScale = true,
    this.enableZoomControls = true,
    this.enableRotation = true,
    this.enableScrolling = true,
  });

  @override
  State<TencentMapWidget> createState() => _TencentMapWidgetState();
}

class _TencentMapWidgetState extends State<TencentMapWidget> {
  @override
  void initState() {
    super.initState();
    widget.controller.zoomLevel.addListener(_onMapStateChanged);
    widget.controller.mapStyle.addListener(_onMapStateChanged);
    widget.controller.latitude.addListener(_onMapStateChanged);
    widget.controller.longitude.addListener(_onMapStateChanged);
    widget.controller.markers.addListener(_onMapStateChanged);
  }

  @override
  void dispose() {
    widget.controller.zoomLevel.removeListener(_onMapStateChanged);
    widget.controller.mapStyle.removeListener(_onMapStateChanged);
    widget.controller.latitude.removeListener(_onMapStateChanged);
    widget.controller.longitude.removeListener(_onMapStateChanged);
    widget.controller.markers.removeListener(_onMapStateChanged);
    super.dispose();
  }

  void _onMapStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.blue.shade100,
            Colors.green.shade100,
            Colors.blue.shade200,
          ],
        ),
      ),
      child: Stack(
        children: [
          _buildMapPlaceholder(),
          if (widget.controller.markers.value.isNotEmpty) _buildMarkers(),
          if (widget.enableZoomControls) _buildZoomControls(),
          if (widget.showCompass) _buildCompass(),
          if (widget.showScale) _buildScale(),
          if (widget.controller.isLoading.value) _buildLoadingOverlay(),
        ],
      ),
    );
  }

  Widget _buildMapPlaceholder() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.map,
            size: 80,
            color: Colors.white.withOpacity(0.8),
          ),
          const SizedBox(height: 16),
          Text(
            'Tencent Map',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white.withOpacity(0.9),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Lat: ${widget.controller.latitude.value.toStringAsFixed(6)}, '
            'Lng: ${widget.controller.longitude.value.toStringAsFixed(6)}',
            style: TextStyle(
              fontSize: 14,
              color: Colors.white.withOpacity(0.8),
            ),
          ),
          Text(
            'Zoom: ${widget.controller.zoomLevel.value.toStringAsFixed(1)}',
            style: TextStyle(
              fontSize: 14,
              color: Colors.white.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMarkers() {
    return Stack(
      children: widget.controller.markers.value.map((marker) {
        return Positioned(
          left: 100,
          top: 100,
          child: GestureDetector(
            onTap: marker.onTap,
            child: Column(
              children: [
                marker.icon ??
                    const Icon(
                      Icons.location_on,
                      color: Colors.red,
                      size: 40,
                    ),
                if (marker.title != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 4,
                        ),
                      ],
                    ),
                    child: Text(
                      marker.title!,
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildZoomControls() {
    return Positioned(
      right: 16,
      bottom: 100,
      child: Column(
        children: [
          FloatingActionButton(
            mini: true,
            onPressed: widget.controller.zoomIn,
            child: const Icon(Icons.add),
          ),
          const SizedBox(height: 8),
          FloatingActionButton(
            mini: true,
            onPressed: widget.controller.zoomOut,
            child: const Icon(Icons.remove),
          ),
        ],
      ),
    );
  }

  Widget _buildCompass() {
    return Positioned(
      top: 16,
      right: 16,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 4,
            ),
          ],
        ),
        child: const Icon(Icons.navigation, color: Colors.blue),
      ),
    );
  }

  Widget _buildScale() {
    return Positioned(
      bottom: 16,
      left: 16,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(4),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 4,
            ),
          ],
        ),
        child: const Text(
          '100m',
          style: TextStyle(fontSize: 12),
        ),
      ),
    );
  }

  Widget _buildLoadingOverlay() {
    return Container(
      color: Colors.black.withOpacity(0.3),
      child: const Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
