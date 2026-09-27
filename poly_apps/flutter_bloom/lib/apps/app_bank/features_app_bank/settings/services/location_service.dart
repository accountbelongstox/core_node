import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../utils/location_helper.dart';

class LocationService {
  static Future<Map<String, double>?> getCurrentLocation() async {
    try {
      if (kIsWeb) {
        return await _getCurrentLocationWeb();
      } else {
        return await _getCurrentLocationNative();
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error getting current location: $e');
      }
      return null;
    }
  }

  static Future<Map<String, double>?> _getCurrentLocationWeb() async {
    try {
      if (!kIsWeb) {
        return null;
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('Error getting web location: $e');
      }
      return null;
    }
  }

  static Future<Map<String, double>?> _getCurrentLocationNative() async {
    try {
      if (kIsWeb) {
        return null;
      }

      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        await openAppSettings();
        return null;
      }

      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );

      return {
        'latitude': position.latitude,
        'longitude': position.longitude,
      };
    } catch (e) {
      if (kDebugMode) {
        print('Error getting native location: $e');
        // Check if it's a MissingPluginException
        if (e.toString().contains('MissingPluginException')) {
          print('⚠️ Geolocator plugin not properly installed. Please:');
          print('   1. Stop the app completely');
          print('   2. Run: flutter clean');
          print('   3. Run: flutter pub get');
          print('   4. Rebuild and restart the app');
        }
      }
      return null;
    }
  }

  static Future<LocationResult?> getLocationInfo(
    double latitude,
    double longitude,
  ) async {
    return await LocationHelper.getLocationFromCoordinates(latitude, longitude);
  }

  static Future<bool> checkLocationServiceEnabled() async {
    return await Geolocator.isLocationServiceEnabled();
  }

  static Future<LocationPermission> checkLocationPermission() async {
    return await Geolocator.checkPermission();
  }

  static Future<LocationPermission> requestLocationPermission() async {
    return await Geolocator.requestPermission();
  }

  static Future<void> openLocationSettings() async {
    await openAppSettings();
  }
}
