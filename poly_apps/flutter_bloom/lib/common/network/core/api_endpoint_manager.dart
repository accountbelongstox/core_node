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

/// Multi-API URL Switching System - Endpoint Manager
/// 
/// This manager implements the multi-URL switching system as described in
/// development-guides/MULTI_API_URL_SYSTEM.md
/// 
/// Features:
/// - Multiple endpoint configuration
/// - Automatic endpoint detection by priority
/// - Health check and connectivity testing
/// - Persistent storage of selected endpoint
/// - User manual selection support
library;

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// API Endpoint configuration
class ApiEndpoint {
  final String id;
  final String url;
  final String protocol;
  final int? port;
  final int priority;
  final bool isLocal;
  final String? description;

  const ApiEndpoint({
    required this.id,
    required this.url,
    required this.protocol,
    this.port,
    this.priority = 100,
    this.isLocal = false,
    this.description,
  });

  /// Build full base URL
  String get baseUrl {
    final portStr = port != null ? ':$port' : '';
    final base = '$protocol://$url$portStr';
    return base.endsWith('/') ? base.substring(0, base.length - 1) : base;
  }

  @override
  String toString() => '$id: $baseUrl (priority: $priority)';
}

/// Endpoint health check result
class EndpointHealthResult {
  final ApiEndpoint endpoint;
  final bool isHealthy;
  final Duration responseTime;
  final String? error;
  final DateTime checkedAt;

  EndpointHealthResult({
    required this.endpoint,
    required this.isHealthy,
    required this.responseTime,
    this.error,
    DateTime? checkedAt,
  }) : checkedAt = checkedAt ?? DateTime.now();

  @override
  String toString() =>
      '${endpoint.id}: ${isHealthy ? "OK" : "FAIL"} (${responseTime.inMilliseconds}ms)';
}

/// Storage interface for endpoint persistence
abstract class EndpointStorage {
  Future<String?> getCurrentEndpointId();
  Future<String?> getAutoDetectedEndpointId();
  Future<String?> getUserModifiedEndpointId();
  Future<void> setCurrentEndpointId(String id);
  Future<void> setAutoDetectedEndpointId(String id);
  Future<void> setUserModifiedEndpointId(String id);
  Future<void> clearAll();
}

/// Default storage implementation using SharedPreferences-like interface
class DefaultEndpointStorage implements EndpointStorage {
  final Future<String?> Function(String key) getString;
  final Future<bool> Function(String key, String value) setString;
  final Future<bool> Function(String key) remove;

  DefaultEndpointStorage({
    required this.getString,
    required this.setString,
    required this.remove,
  });

  @override
  Future<String?> getCurrentEndpointId() => getString('api_current_endpoint');

  @override
  Future<String?> getAutoDetectedEndpointId() => getString('api_auto_detected');

  @override
  Future<String?> getUserModifiedEndpointId() => getString('api_user_modified');

  @override
  Future<void> setCurrentEndpointId(String id) => setString('api_current_endpoint', id).then((_) => null);

  @override
  Future<void> setAutoDetectedEndpointId(String id) => setString('api_auto_detected', id).then((_) => null);

  @override
  Future<void> setUserModifiedEndpointId(String id) => setString('api_user_modified', id).then((_) => null);

  @override
  Future<void> clearAll() async {
    await remove('api_current_endpoint');
    await remove('api_auto_detected');
    await remove('api_user_modified');
  }
}

/// API Endpoint Manager
/// 
/// Manages multiple API endpoints with automatic detection and switching
class ApiEndpointManager {
  static final ApiEndpointManager _instance = ApiEndpointManager._internal();
  factory ApiEndpointManager() => _instance;
  ApiEndpointManager._internal();

  List<ApiEndpoint> _endpoints = [];
  ApiEndpoint? _currentEndpoint;
  EndpointStorage? _storage;
  final http.Client _httpClient = http.Client();
  final Map<String, EndpointHealthResult> _healthCache = {};
  bool _isInitialized = false;

  /// Configure endpoints
  void configureEndpoints(List<ApiEndpoint> endpoints) {
    _endpoints = List.from(endpoints);
    _endpoints.sort((a, b) => a.priority.compareTo(b.priority));
    _healthCache.clear();
  }

  /// Set storage implementation
  void setStorage(EndpointStorage storage) {
    _storage = storage;
  }

  /// Get configured endpoints
  List<ApiEndpoint> get endpoints => List.unmodifiable(_endpoints);

  /// Get current endpoint
  ApiEndpoint? get currentEndpoint => _currentEndpoint;

  /// Get current base URL
  String? getCurrentBaseUrl() => _currentEndpoint?.baseUrl;

  /// Initialize the manager
  /// 
  /// Priority:
  /// 1. User manually selected endpoint
  /// 2. Auto-detected endpoint
  /// 3. Execute auto-detection
  Future<void> initialize({
    bool autoDetect = true,
    Duration timeout = const Duration(seconds: 1),
    String? healthCheckPath,
  }) async {
    if (_isInitialized && _currentEndpoint != null) {
      return;
    }

    if (_endpoints.isEmpty) {
      debugPrint('⚠️ ApiEndpointManager: No endpoints configured');
      return;
    }

    ApiEndpoint? selectedEndpoint;

    if (_storage != null) {
      final userModifiedId = await _storage!.getUserModifiedEndpointId();
      if (userModifiedId != null) {
        selectedEndpoint = _getEndpointById(userModifiedId);
        if (selectedEndpoint != null) {
          debugPrint('✅ ApiEndpointManager: Using user-selected endpoint: ${selectedEndpoint.id}');
          _currentEndpoint = selectedEndpoint;
          _isInitialized = true;
          return;
        }
      }

      final autoDetectedId = await _storage!.getAutoDetectedEndpointId();
      if (autoDetectedId != null) {
        selectedEndpoint = _getEndpointById(autoDetectedId);
        if (selectedEndpoint != null) {
          debugPrint('✅ ApiEndpointManager: Using auto-detected endpoint: ${selectedEndpoint.id}');
          _currentEndpoint = selectedEndpoint;
          _isInitialized = true;
          
          if (autoDetect) {
            _autoDetectInBackground(timeout: timeout, healthCheckPath: healthCheckPath);
          }
          return;
        }
      }
    }

    if (autoDetect) {
      selectedEndpoint = await autoDetectEndpoint(
        timeout: timeout,
        healthCheckPath: healthCheckPath,
      );
    } else {
      selectedEndpoint = _endpoints.first;
    }

    if (selectedEndpoint != null) {
      _currentEndpoint = selectedEndpoint;
      if (_storage != null) {
        await _storage!.setCurrentEndpointId(selectedEndpoint.id);
        await _storage!.setAutoDetectedEndpointId(selectedEndpoint.id);
      }
      debugPrint('✅ ApiEndpointManager: Initialized with endpoint: ${selectedEndpoint.id}');
    }

    _isInitialized = true;
  }

  /// Auto-detect available endpoint
  /// 
  /// Tests endpoints by priority and returns the first available one
  Future<ApiEndpoint?> autoDetectEndpoint({
    Duration timeout = const Duration(seconds: 1),
    String? healthCheckPath,
  }) async {
    if (_endpoints.isEmpty) {
      return null;
    }

    final testPath = healthCheckPath ?? '/';
    debugPrint('🔍 ApiEndpointManager: Starting auto-detection...');

    for (final endpoint in _endpoints) {
      final result = await checkEndpoint(endpoint, timeout: timeout, path: testPath);
      if (result.isHealthy) {
        debugPrint('✅ ApiEndpointManager: Auto-detected endpoint: ${endpoint.id} (${result.responseTime.inMilliseconds}ms)');
        if (_storage != null) {
          await _storage!.setAutoDetectedEndpointId(endpoint.id);
        }
        return endpoint;
      }
    }

    debugPrint('⚠️ ApiEndpointManager: No available endpoint found');
    return null;
  }

  /// Check endpoint health
  Future<EndpointHealthResult> checkEndpoint(
    ApiEndpoint endpoint, {
    Duration timeout = const Duration(seconds: 1),
    String path = '/',
  }) async {
    final stopwatch = Stopwatch()..start();
    final url = '${endpoint.baseUrl}$path';

    try {
      final response = await _httpClient
          .get(Uri.parse(url))
          .timeout(timeout);

      stopwatch.stop();
      final statusCode = response.statusCode;
      final isHealthy = statusCode >= 200 && statusCode < 500;

      final result = EndpointHealthResult(
        endpoint: endpoint,
        isHealthy: isHealthy,
        responseTime: stopwatch.elapsed,
        error: isHealthy ? null : 'HTTP $statusCode',
      );

      _healthCache[endpoint.id] = result;
      return result;
    } catch (e) {
      stopwatch.stop();
      final result = EndpointHealthResult(
        endpoint: endpoint,
        isHealthy: false,
        responseTime: stopwatch.elapsed,
        error: e.toString(),
      );
      _healthCache[endpoint.id] = result;
      return result;
    }
  }

  /// Set endpoint manually (user selection)
  Future<void> setEndpoint(String endpointId) async {
    final endpoint = _getEndpointById(endpointId);
    if (endpoint == null) {
      throw ArgumentError('Endpoint not found: $endpointId');
    }

    _currentEndpoint = endpoint;
    if (_storage != null) {
      await _storage!.setCurrentEndpointId(endpointId);
      await _storage!.setUserModifiedEndpointId(endpointId);
    }
    debugPrint('✅ ApiEndpointManager: Manually set endpoint: ${endpoint.id}');
  }

  /// Get endpoint by ID
  ApiEndpoint? _getEndpointById(String id) {
    try {
      return _endpoints.firstWhere((e) => e.id == id);
    } catch (e) {
      return null;
    }
  }

  /// Background auto-detection
  void _autoDetectInBackground({
    Duration timeout = const Duration(seconds: 1),
    String? healthCheckPath,
  }) {
    Future.microtask(() async {
      final detected = await autoDetectEndpoint(
        timeout: timeout,
        healthCheckPath: healthCheckPath,
      );
      if (detected != null && detected.id != _currentEndpoint?.id) {
        if (_storage != null && await _storage!.getUserModifiedEndpointId() == null) {
          _currentEndpoint = detected;
          await _storage!.setCurrentEndpointId(detected.id);
          await _storage!.setAutoDetectedEndpointId(detected.id);
          debugPrint('🔄 ApiEndpointManager: Switched to better endpoint: ${detected.id}');
        }
      }
    });
  }

  /// Get health status of all endpoints
  Map<String, EndpointHealthResult> getHealthStatus() {
    return Map.unmodifiable(_healthCache);
  }

  /// Refresh health check for all endpoints
  Future<void> refreshHealthCheck({
    Duration timeout = const Duration(seconds: 1),
    String? healthCheckPath,
  }) async {
    _healthCache.clear();
    if (_endpoints.isNotEmpty) {
      await autoDetectEndpoint(
        timeout: timeout,
        healthCheckPath: healthCheckPath,
      );
    }
  }

  /// Reset manager state
  void reset() {
    _currentEndpoint = null;
    _healthCache.clear();
    _isInitialized = false;
  }

  /// Dispose resources
  void dispose() {
    _httpClient.close();
    reset();
  }
}
