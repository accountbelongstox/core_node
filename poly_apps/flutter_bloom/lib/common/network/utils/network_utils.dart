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
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';

class NetworkUtils {
  static NetworkUtils? _instance;
  static NetworkUtils get instance => _instance ??= NetworkUtils._internal();
  
  NetworkUtils._internal();

  final StreamController<bool> _connectivityController = StreamController<bool>.broadcast();
  Timer? _connectivityTimer;
  bool _isConnected = true;

  Stream<bool> get connectivityStream => _connectivityController.stream;
  bool get isConnected => _isConnected;

  /// Initialize network monitoring
  Future<void> initialize() async {
    await checkConnectivity();
    _startConnectivityMonitoring();
  }

  /// Check current network connectivity
  Future<bool> checkConnectivity() async {
    try {
      if (kIsWeb) {
        _isConnected = await _checkConnectivityWeb();
      } else {
        _isConnected = await _checkConnectivityNative();
      }
      
      _connectivityController.add(_isConnected);
      return _isConnected;
    } catch (e) {
      if (kDebugMode) {
        print('Error checking connectivity: $e');
      }
      _isConnected = false;
      _connectivityController.add(_isConnected);
      return false;
    }
  }

  /// Start monitoring connectivity changes
  void _startConnectivityMonitoring() {
    _connectivityTimer?.cancel();
    _connectivityTimer = Timer.periodic(Duration(seconds: 5), (timer) {
      checkConnectivity();
    });
  }

  /// Stop monitoring connectivity changes
  void stopConnectivityMonitoring() {
    _connectivityTimer?.cancel();
    _connectivityTimer = null;
  }

  /// Check connectivity on web platform
  Future<bool> _checkConnectivityWeb() async {
    try {
      // For web, we can check if navigator.onLine is available
      // This is a mock implementation
      return true; // Assume connected on web
    } catch (e) {
      return false;
    }
  }

  /// Check connectivity on native platforms
  Future<bool> _checkConnectivityNative() async {
    try {
      // Try to connect to a reliable host
      final result = await InternetAddress.lookup('google.com')
          .timeout(Duration(seconds: 3));
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } catch (e) {
      return false;
    }
  }

  /// Validate URL format
  static bool isValidUrl(String url) {
    try {
      final uri = Uri.parse(url);
      return uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https');
    } catch (e) {
      return false;
    }
  }

  /// Validate email format
  static bool isValidEmail(String email) {
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );
    return emailRegex.hasMatch(email);
  }

  /// Encode URL parameters
  static String encodeQueryParameters(Map<String, dynamic> params) {
    final encodedParams = <String>[];
    
    params.forEach((key, value) {
      if (value != null) {
        final encodedKey = Uri.encodeComponent(key);
        final encodedValue = Uri.encodeComponent(value.toString());
        encodedParams.add('$encodedKey=$encodedValue');
      }
    });
    
    return encodedParams.join('&');
  }

  /// Build URL with query parameters
  static String buildUrlWithParams(String baseUrl, Map<String, dynamic>? params) {
    if (params == null || params.isEmpty) {
      return baseUrl;
    }
    
    final queryString = encodeQueryParameters(params);
    final separator = baseUrl.contains('?') ? '&' : '?';
    
    return '$baseUrl$separator$queryString';
  }

  /// Parse query parameters from URL
  static Map<String, String> parseQueryParameters(String url) {
    final uri = Uri.parse(url);
    return uri.queryParameters;
  }

  /// Get domain from URL
  static String? getDomainFromUrl(String url) {
    try {
      final uri = Uri.parse(url);
      return uri.host;
    } catch (e) {
      return null;
    }
  }

  /// Check if URL is HTTPS
  static bool isHttps(String url) {
    try {
      final uri = Uri.parse(url);
      return uri.scheme == 'https';
    } catch (e) {
      return false;
    }
  }

  /// Format file size for display
  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// Get MIME type from file extension
  static String getMimeType(String fileName) {
    final extension = fileName.split('.').last.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'json':
        return 'application/json';
      case 'xml':
        return 'application/xml';
      case 'zip':
        return 'application/zip';
      case 'mp4':
        return 'video/mp4';
      case 'mp3':
        return 'audio/mpeg';
      default:
        return 'application/octet-stream';
    }
  }

  /// Sanitize filename for safe storage
  static String sanitizeFileName(String fileName) {
    // Remove or replace invalid characters
    final sanitized = fileName
        .replaceAll(RegExp(r'[<>:"/\\|?*]'), '_')
        .replaceAll(RegExp(r'\s+'), '_')
        .replaceAll(RegExp(r'_+'), '_');
    
    // Ensure it's not empty and not too long
    if (sanitized.isEmpty) return 'file';
    if (sanitized.length > 255) return sanitized.substring(0, 255);
    
    return sanitized;
  }

  /// Generate unique request ID
  static String generateRequestId() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = (timestamp % 10000).toString().padLeft(4, '0');
    return 'req_${timestamp}_$random';
  }

  /// Calculate request timeout based on content size
  static Duration calculateTimeout(int? contentLength) {
    if (contentLength == null) return Duration(seconds: 30);
    
    // Base timeout of 10 seconds + 1 second per MB
    final baseDuration = Duration(seconds: 10);
    final additionalDuration = Duration(
      seconds: (contentLength / (1024 * 1024)).ceil(),
    );
    
    final totalDuration = baseDuration + additionalDuration;
    
    // Cap at 5 minutes
    return totalDuration > Duration(minutes: 5) 
        ? Duration(minutes: 5) 
        : totalDuration;
  }

  /// Check if response is JSON
  static bool isJsonResponse(Map<String, String>? headers) {
    final contentType = headers?['content-type']?.toLowerCase();
    return contentType?.contains('application/json') ?? false;
  }

  /// Parse JSON safely
  static dynamic parseJsonSafely(String jsonString) {
    try {
      return json.decode(jsonString);
    } catch (e) {
      if (kDebugMode) {
        print('Failed to parse JSON: $e');
      }
      return null;
    }
  }

  /// Convert object to JSON string safely
  static String? toJsonStringSafely(dynamic object) {
    try {
      return json.encode(object);
    } catch (e) {
      if (kDebugMode) {
        print('Failed to encode JSON: $e');
      }
      return null;
    }
  }

  /// Get user agent string
  static String getUserAgent() {
    if (kIsWeb) {
      return 'Flutter Web App';
    } else if (Platform.isAndroid) {
      return 'Flutter Android App';
    } else if (Platform.isIOS) {
      return 'Flutter iOS App';
    } else if (Platform.isMacOS) {
      return 'Flutter macOS App';
    } else if (Platform.isWindows) {
      return 'Flutter Windows App';
    } else if (Platform.isLinux) {
      return 'Flutter Linux App';
    } else {
      return 'Flutter App';
    }
  }

  /// Check if running on mobile platform
  static bool isMobilePlatform() {
    if (kIsWeb) return false;
    return Platform.isAndroid || Platform.isIOS;
  }

  /// Check if running on desktop platform
  static bool isDesktopPlatform() {
    if (kIsWeb) return false;
    return Platform.isMacOS || Platform.isWindows || Platform.isLinux;
  }

  /// Get platform name
  static String getPlatformName() {
    if (kIsWeb) return 'Web';
    if (Platform.isAndroid) return 'Android';
    if (Platform.isIOS) return 'iOS';
    if (Platform.isMacOS) return 'macOS';
    if (Platform.isWindows) return 'Windows';
    if (Platform.isLinux) return 'Linux';
    return 'Unknown';
  }

  /// Dispose resources
  void dispose() {
    stopConnectivityMonitoring();
    _connectivityController.close();
  }
}
