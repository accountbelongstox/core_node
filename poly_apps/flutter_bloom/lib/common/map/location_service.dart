// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'map_service.dart';

abstract class LocationServiceInterface {
  Future<bool> requestPermission();
  Future<bool> isLocationServiceEnabled();
  Future<LocationPermissionStatus> checkPermissionStatus();
  Future<LatLng?> getCurrentLocation();
  Stream<LatLng> getLocationStream();
  Future<void> startLocationUpdates({LocationAccuracy accuracy = LocationAccuracy.high});
  Future<void> stopLocationUpdates();
  Future<double> getDistanceBetween(LatLng start, LatLng end);
  Future<double> getBearingBetween(LatLng start, LatLng end);
}

enum LocationPermissionStatus {
  denied,
  deniedForever,
  whileInUse,
  always,
  unableToDetermine
}

enum LocationAccuracy {
  lowest,
  low,
  medium,
  high,
  best,
  bestForNavigation
}

class LocationData {
  final LatLng position;
  final double? accuracy;
  final double? altitude;
  final double? heading;
  final double? speed;
  final DateTime timestamp;

  const LocationData({
    required this.position,
    this.accuracy,
    this.altitude,
    this.heading,
    this.speed,
    required this.timestamp,
  });

  @override
  String toString() => 'LocationData(position: $position, accuracy: $accuracy, timestamp: $timestamp)';
}

class LocationService implements LocationServiceInterface {
  static LocationService? _instance;
  static LocationService get instance => _instance ??= LocationService._internal();
  
  LocationService._internal();

  final StreamController<LatLng> _locationController = StreamController<LatLng>.broadcast();
  Timer? _locationTimer;
  bool _isListening = false;
  LocationAccuracy _currentAccuracy = LocationAccuracy.high;
  LatLng? _lastKnownLocation;

  Stream<LatLng> get locationStream => _locationController.stream;
  bool get isListening => _isListening;
  LatLng? get lastKnownLocation => _lastKnownLocation;

  @override
  Future<bool> requestPermission() async {
    try {
      if (kIsWeb) {
        return await _requestPermissionWeb();
      } else {
        return await _requestPermissionNative();
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error requesting location permission: $e');
      }
      return false;
    }
  }

  @override
  Future<bool> isLocationServiceEnabled() async {
    try {
      if (kIsWeb) {
        return await _isLocationServiceEnabledWeb();
      } else {
        return await _isLocationServiceEnabledNative();
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error checking location service status: $e');
      }
      return false;
    }
  }

  @override
  Future<LocationPermissionStatus> checkPermissionStatus() async {
    try {
      if (kIsWeb) {
        return await _checkPermissionStatusWeb();
      } else {
        return await _checkPermissionStatusNative();
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error checking permission status: $e');
      }
      return LocationPermissionStatus.unableToDetermine;
    }
  }

  @override
  Future<LatLng?> getCurrentLocation() async {
    try {
      if (!await isLocationServiceEnabled()) {
        throw Exception('Location service is not enabled');
      }

      final permissionStatus = await checkPermissionStatus();
      if (permissionStatus == LocationPermissionStatus.denied ||
          permissionStatus == LocationPermissionStatus.deniedForever) {
        throw Exception('Location permission denied');
      }

      LatLng? location;
      if (kIsWeb) {
        location = await _getCurrentLocationWeb();
      } else {
        location = await _getCurrentLocationNative();
      }

      if (location != null) {
        _lastKnownLocation = location;
      }

      return location;
    } catch (e) {
      if (kDebugMode) {
        print('Error getting current location: $e');
      }
      return null;
    }
  }

  @override
  Stream<LatLng> getLocationStream() {
    return _locationController.stream;
  }

  @override
  Future<void> startLocationUpdates({LocationAccuracy accuracy = LocationAccuracy.high}) async {
    if (_isListening) return;

    try {
      if (!await isLocationServiceEnabled()) {
        throw Exception('Location service is not enabled');
      }

      final permissionStatus = await checkPermissionStatus();
      if (permissionStatus == LocationPermissionStatus.denied ||
          permissionStatus == LocationPermissionStatus.deniedForever) {
        throw Exception('Location permission denied');
      }

      _currentAccuracy = accuracy;
      _isListening = true;

      if (kIsWeb) {
        await _startLocationUpdatesWeb();
      } else {
        await _startLocationUpdatesNative();
      }

      if (kDebugMode) {
        print('Started location updates with accuracy: $accuracy');
      }
    } catch (e) {
      _isListening = false;
      if (kDebugMode) {
        print('Error starting location updates: $e');
      }
      rethrow;
    }
  }

  @override
  Future<void> stopLocationUpdates() async {
    if (!_isListening) return;

    _isListening = false;
    _locationTimer?.cancel();
    _locationTimer = null;

    if (kDebugMode) {
      print('Stopped location updates');
    }
  }

  @override
  Future<double> getDistanceBetween(LatLng start, LatLng end) async {
    // Haversine formula for calculating distance between two points
    const double earthRadius = 6371000; // Earth's radius in meters

    final double lat1Rad = start.latitude * (3.14159265359 / 180);
    final double lat2Rad = end.latitude * (3.14159265359 / 180);
    final double deltaLatRad = (end.latitude - start.latitude) * (3.14159265359 / 180);
    final double deltaLngRad = (end.longitude - start.longitude) * (3.14159265359 / 180);

    final double a = sin(deltaLatRad / 2) * sin(deltaLatRad / 2) +
        cos(lat1Rad) * cos(lat2Rad) *
        sin(deltaLngRad / 2) * sin(deltaLngRad / 2);
    final double c = 2 * asin(sqrt(a));

    return earthRadius * c;
  }

  @override
  Future<double> getBearingBetween(LatLng start, LatLng end) async {
    final double lat1Rad = start.latitude * (3.14159265359 / 180);
    final double lat2Rad = end.latitude * (3.14159265359 / 180);
    final double deltaLngRad = (end.longitude - start.longitude) * (3.14159265359 / 180);

    final double y = sin(deltaLngRad) * cos(lat2Rad);
    final double x = cos(lat1Rad) * sin(lat2Rad) - 
        sin(lat1Rad) * cos(lat2Rad) * cos(deltaLngRad);

    final double bearingRad = atan2(y, x);
    final double bearingDeg = bearingRad * (180 / 3.14159265359);

    return (bearingDeg + 360) % 360;
  }

  // Web-specific implementations
  Future<bool> _requestPermissionWeb() async {
    if (kDebugMode) {
      print('Requesting location permission on web');
    }
    await Future.delayed(Duration(milliseconds: 500));
    return true; // Mock permission granted
  }

  Future<bool> _isLocationServiceEnabledWeb() async {
    if (kDebugMode) {
      print('Checking location service status on web');
    }
    return true; // Web geolocation is always "enabled" if supported
  }

  Future<LocationPermissionStatus> _checkPermissionStatusWeb() async {
    if (kDebugMode) {
      print('Checking permission status on web');
    }
    return LocationPermissionStatus.whileInUse; // Mock status
  }

  Future<LatLng?> _getCurrentLocationWeb() async {
    if (kDebugMode) {
      print('Getting current location on web');
    }
    await Future.delayed(Duration(milliseconds: 1000));
    
    // Mock location (New York City)
    return LatLng(40.7128, -74.0060);
  }

  Future<void> _startLocationUpdatesWeb() async {
    if (kDebugMode) {
      print('Starting location updates on web');
    }
    
    // Simulate location updates
    _locationTimer = Timer.periodic(Duration(seconds: 5), (timer) {
      if (!_isListening) {
        timer.cancel();
        return;
      }
      
      // Mock location with slight variations
      final baseLocation = LatLng(40.7128, -74.0060);
      final variation = (DateTime.now().millisecondsSinceEpoch % 1000) / 100000;
      final mockLocation = LatLng(
        baseLocation.latitude + variation,
        baseLocation.longitude + variation,
      );
      
      _lastKnownLocation = mockLocation;
      _locationController.add(mockLocation);
    });
  }

  // Native-specific implementations
  Future<bool> _requestPermissionNative() async {
    if (kDebugMode) {
      print('Requesting location permission on native');
    }
    await Future.delayed(Duration(milliseconds: 500));
    return true; // Mock permission granted
  }

  Future<bool> _isLocationServiceEnabledNative() async {
    if (kDebugMode) {
      print('Checking location service status on native');
    }
    return true; // Mock service enabled
  }

  Future<LocationPermissionStatus> _checkPermissionStatusNative() async {
    if (kDebugMode) {
      print('Checking permission status on native');
    }
    return LocationPermissionStatus.whileInUse; // Mock status
  }

  Future<LatLng?> _getCurrentLocationNative() async {
    if (kDebugMode) {
      print('Getting current location on native');
    }
    await Future.delayed(Duration(milliseconds: 1000));
    
    // Mock location (San Francisco)
    return LatLng(37.7749, -122.4194);
  }

  Future<void> _startLocationUpdatesNative() async {
    if (kDebugMode) {
      print('Starting location updates on native');
    }
    
    // Simulate location updates
    _locationTimer = Timer.periodic(Duration(seconds: 3), (timer) {
      if (!_isListening) {
        timer.cancel();
        return;
      }
      
      // Mock location with slight variations
      final baseLocation = LatLng(37.7749, -122.4194);
      final variation = (DateTime.now().millisecondsSinceEpoch % 1000) / 100000;
      final mockLocation = LatLng(
        baseLocation.latitude + variation,
        baseLocation.longitude + variation,
      );
      
      _lastKnownLocation = mockLocation;
      _locationController.add(mockLocation);
    });
  }

  void dispose() {
    stopLocationUpdates();
    _locationController.close();
  }
}
