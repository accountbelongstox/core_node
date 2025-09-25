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

import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'map_service.dart';

class MapUtils {
  static const double earthRadius = 6371000; // Earth's radius in meters
  static const double pi = 3.14159265359;

  /// Calculate distance between two points using Haversine formula
  /// Returns distance in meters
  static double calculateDistance(LatLng point1, LatLng point2) {
    final double lat1Rad = point1.latitude * (pi / 180);
    final double lat2Rad = point2.latitude * (pi / 180);
    final double deltaLatRad = (point2.latitude - point1.latitude) * (pi / 180);
    final double deltaLngRad = (point2.longitude - point1.longitude) * (pi / 180);

    final double a = math.pow(math.sin(deltaLatRad / 2), 2) +
        math.cos(lat1Rad) * math.cos(lat2Rad) *
        math.pow(math.sin(deltaLngRad / 2), 2);
    final double c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));

    return earthRadius * c;
  }

  /// Calculate bearing between two points
  /// Returns bearing in degrees (0-360)
  static double calculateBearing(LatLng start, LatLng end) {
    final double lat1Rad = start.latitude * (pi / 180);
    final double lat2Rad = end.latitude * (pi / 180);
    final double deltaLngRad = (end.longitude - start.longitude) * (pi / 180);

    final double y = math.sin(deltaLngRad) * math.cos(lat2Rad);
    final double x = math.cos(lat1Rad) * math.sin(lat2Rad) - 
        math.sin(lat1Rad) * math.cos(lat2Rad) * math.cos(deltaLngRad);

    final double bearingRad = math.atan2(y, x);
    final double bearingDeg = bearingRad * (180 / pi);

    return (bearingDeg + 360) % 360;
  }

  /// Calculate midpoint between two coordinates
  static LatLng calculateMidpoint(LatLng point1, LatLng point2) {
    final double lat1Rad = point1.latitude * (pi / 180);
    final double lat2Rad = point2.latitude * (pi / 180);
    final double deltaLngRad = (point2.longitude - point1.longitude) * (pi / 180);

    final double bx = math.cos(lat2Rad) * math.cos(deltaLngRad);
    final double by = math.cos(lat2Rad) * math.sin(deltaLngRad);

    final double lat3Rad = math.atan2(
      math.sin(lat1Rad) + math.sin(lat2Rad),
      math.sqrt((math.cos(lat1Rad) + bx) * (math.cos(lat1Rad) + bx) + by * by)
    );
    final double lng3Rad = (point1.longitude * (pi / 180)) + math.atan2(by, math.cos(lat1Rad) + bx);

    return LatLng(lat3Rad * (180 / pi), lng3Rad * (180 / pi));
  }

  /// Calculate bounding box for a list of coordinates
  static MapBounds calculateBounds(List<LatLng> points) {
    if (points.isEmpty) {
      throw ArgumentError('Points list cannot be empty');
    }

    double minLat = points.first.latitude;
    double maxLat = points.first.latitude;
    double minLng = points.first.longitude;
    double maxLng = points.first.longitude;

    for (final point in points) {
      minLat = math.min(minLat, point.latitude);
      maxLat = math.max(maxLat, point.latitude);
      minLng = math.min(minLng, point.longitude);
      maxLng = math.max(maxLng, point.longitude);
    }

    return MapBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }

  /// Check if a point is within a bounding box
  static bool isPointInBounds(LatLng point, MapBounds bounds) {
    return point.latitude >= bounds.southwest.latitude &&
           point.latitude <= bounds.northeast.latitude &&
           point.longitude >= bounds.southwest.longitude &&
           point.longitude <= bounds.northeast.longitude;
  }

  /// Calculate destination point given start point, bearing and distance
  static LatLng calculateDestination(LatLng start, double bearing, double distance) {
    final double bearingRad = bearing * (pi / 180);
    final double lat1Rad = start.latitude * (pi / 180);
    final double lng1Rad = start.longitude * (pi / 180);

    final double lat2Rad = math.asin(
      math.sin(lat1Rad) * math.cos(distance / earthRadius) +
      math.cos(lat1Rad) * math.sin(distance / earthRadius) * math.cos(bearingRad)
    );

    final double lng2Rad = lng1Rad + math.atan2(
      math.sin(bearingRad) * math.sin(distance / earthRadius) * math.cos(lat1Rad),
      math.cos(distance / earthRadius) - math.sin(lat1Rad) * math.sin(lat2Rad)
    );

    return LatLng(lat2Rad * (180 / pi), lng2Rad * (180 / pi));
  }

  /// Format coordinates to readable string
  static String formatCoordinates(LatLng coordinates, {int precision = 6}) {
    return '${coordinates.latitude.toStringAsFixed(precision)}, ${coordinates.longitude.toStringAsFixed(precision)}';
  }

  /// Format distance to readable string
  static String formatDistance(double distanceInMeters) {
    if (distanceInMeters < 1000) {
      return '${distanceInMeters.toStringAsFixed(0)} m';
    } else if (distanceInMeters < 10000) {
      return '${(distanceInMeters / 1000).toStringAsFixed(1)} km';
    } else {
      return '${(distanceInMeters / 1000).toStringAsFixed(0)} km';
    }
  }

  /// Format bearing to readable string
  static String formatBearing(double bearing) {
    final directions = [
      'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];
    
    final index = ((bearing + 11.25) / 22.5).floor() % 16;
    return '${directions[index]} (${bearing.toStringAsFixed(0)}°)';
  }

  /// Convert degrees to radians
  static double degreesToRadians(double degrees) {
    return degrees * (pi / 180);
  }

  /// Convert radians to degrees
  static double radiansToDegrees(double radians) {
    return radians * (180 / pi);
  }

  /// Validate latitude value
  static bool isValidLatitude(double latitude) {
    return latitude >= -90.0 && latitude <= 90.0;
  }

  /// Validate longitude value
  static bool isValidLongitude(double longitude) {
    return longitude >= -180.0 && longitude <= 180.0;
  }

  /// Validate coordinates
  static bool isValidCoordinates(LatLng coordinates) {
    return isValidLatitude(coordinates.latitude) && 
           isValidLongitude(coordinates.longitude);
  }

  /// Normalize longitude to -180 to 180 range
  static double normalizeLongitude(double longitude) {
    while (longitude > 180) longitude -= 360;
    while (longitude < -180) longitude += 360;
    return longitude;
  }

  /// Calculate zoom level to fit bounds in given dimensions
  static double calculateZoomLevel(MapBounds bounds, double mapWidth, double mapHeight) {
    const double worldDim = 256;
    const double zoomMax = 21;

    double latRad(double lat) => lat * (pi / 180);

    final double latFraction = (latRad(bounds.northeast.latitude) - latRad(bounds.southwest.latitude)) / pi;
    final double lngDiff = bounds.northeast.longitude - bounds.southwest.longitude;
    final double lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;

    final double latZoom = math.log(mapHeight / worldDim / latFraction) / math.ln2;
    final double lngZoom = math.log(mapWidth / worldDim / lngFraction) / math.ln2;

    return math.min(math.min(latZoom, lngZoom), zoomMax);
  }

  /// Generate random coordinates within bounds
  static LatLng generateRandomCoordinates(MapBounds bounds) {
    final random = math.Random();
    
    final double lat = bounds.southwest.latitude + 
        random.nextDouble() * (bounds.northeast.latitude - bounds.southwest.latitude);
    final double lng = bounds.southwest.longitude + 
        random.nextDouble() * (bounds.northeast.longitude - bounds.southwest.longitude);
    
    return LatLng(lat, lng);
  }

  /// Simplify polyline using Douglas-Peucker algorithm
  static List<LatLng> simplifyPolyline(List<LatLng> points, double tolerance) {
    if (points.length <= 2) return points;

    // Find the point with maximum distance from line between first and last points
    double maxDistance = 0;
    int maxIndex = 0;
    
    for (int i = 1; i < points.length - 1; i++) {
      final double distance = _perpendicularDistance(points[i], points.first, points.last);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      final List<LatLng> leftPart = simplifyPolyline(points.sublist(0, maxIndex + 1), tolerance);
      final List<LatLng> rightPart = simplifyPolyline(points.sublist(maxIndex), tolerance);
      
      return [...leftPart.sublist(0, leftPart.length - 1), ...rightPart];
    } else {
      return [points.first, points.last];
    }
  }

  /// Calculate perpendicular distance from point to line
  static double _perpendicularDistance(LatLng point, LatLng lineStart, LatLng lineEnd) {
    final double A = point.latitude - lineStart.latitude;
    final double B = point.longitude - lineStart.longitude;
    final double C = lineEnd.latitude - lineStart.latitude;
    final double D = lineEnd.longitude - lineStart.longitude;

    final double dot = A * C + B * D;
    final double lenSq = C * C + D * D;
    
    if (lenSq == 0) return calculateDistance(point, lineStart);

    final double param = dot / lenSq;
    
    LatLng closestPoint;
    if (param < 0) {
      closestPoint = lineStart;
    } else if (param > 1) {
      closestPoint = lineEnd;
    } else {
      closestPoint = LatLng(
        lineStart.latitude + param * C,
        lineStart.longitude + param * D,
      );
    }

    return calculateDistance(point, closestPoint);
  }
}

class MapBounds {
  final LatLng southwest;
  final LatLng northeast;

  const MapBounds({
    required this.southwest,
    required this.northeast,
  });

  LatLng get center => MapUtils.calculateMidpoint(southwest, northeast);

  double get width => northeast.longitude - southwest.longitude;
  double get height => northeast.latitude - southwest.latitude;

  bool contains(LatLng point) => MapUtils.isPointInBounds(point, this);

  @override
  String toString() => 'MapBounds(SW: $southwest, NE: $northeast)';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MapBounds &&
        other.southwest == southwest &&
        other.northeast == northeast;
  }

  @override
  int get hashCode => southwest.hashCode ^ northeast.hashCode;
}
