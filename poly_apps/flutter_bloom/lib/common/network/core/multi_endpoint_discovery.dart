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

/// Multi-endpoint discovery service for scanning and selecting available API endpoints
/// This service is in common area and does not depend on app-specific code
library;

import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Endpoint configuration model
class EndpointConfig {
  final String id;
  final String url;
  final String protocol;
  final int? port;
  final int priority;
  final String? description;
  final bool isLocal;

  const EndpointConfig({
    required this.id,
    required this.url,
    required this.protocol,
    this.port,
    this.priority = 100,
    this.description,
    this.isLocal = false,
  });

  /// Build full URL from endpoint config
  String buildFullUrl({String? path}) {
    final portStr = port != null ? ':$port' : '';
    final baseUrl = '$protocol://$url$portStr';
    if (path == null || path.isEmpty) {
      return baseUrl;
    }
    // Remove leading slashes from path and ensure single slash between base and path
    final cleanPath = path.replaceFirst(RegExp(r'^/+'), '');
    return '$baseUrl/$cleanPath';
  }

  @override
  String toString() => buildFullUrl();
}

/// Endpoint health check result
class EndpointHealthResult {
  final EndpointConfig endpoint;
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

/// Multi-endpoint discovery service
/// Scans multiple endpoints and selects the best available one
class MultiEndpointDiscovery {
  static final MultiEndpointDiscovery _instance =
      MultiEndpointDiscovery._internal();
  factory MultiEndpointDiscovery() => _instance;
  MultiEndpointDiscovery._internal();

  final Dio _dio = Dio();
  final Map<String, EndpointHealthResult> _healthCache = {};
  EndpointConfig? _selectedEndpoint;
  List<EndpointConfig> _endpoints = [];

  /// Configure endpoints to scan
  /// This should be called by app-specific configuration
  void configureEndpoints(List<EndpointConfig> endpoints) {
    _endpoints = List.from(endpoints);
    _healthCache.clear();
    _selectedEndpoint = null;
  }

  /// Get configured endpoints
  List<EndpointConfig> get endpoints => List.unmodifiable(_endpoints);

  /// Get currently selected endpoint
  EndpointConfig? get selectedEndpoint => _selectedEndpoint;

  /// Scan all endpoints and select the best available one
  /// Returns the selected endpoint or null if none are available
  Future<EndpointConfig?> discoverAvailableEndpoint({
    String? healthCheckPath,
    Duration timeout = const Duration(seconds: 3),
    bool parallelScan = true,
  }) async {
    if (_endpoints.isEmpty) {
      debugPrint('⚠️ MultiEndpointDiscovery: No endpoints configured');
      return null;
    }

    // Sort by priority (lower number = higher priority)
    final sortedEndpoints = List<EndpointConfig>.from(_endpoints)
      ..sort((a, b) => a.priority.compareTo(b.priority));

    if (parallelScan) {
      return await _parallelScan(sortedEndpoints, healthCheckPath, timeout);
    } else {
      return await _sequentialScan(sortedEndpoints, healthCheckPath, timeout);
    }
  }

  /// Parallel scan for faster discovery
  Future<EndpointConfig?> _parallelScan(
    List<EndpointConfig> endpoints,
    String? healthCheckPath,
    Duration timeout,
  ) async {
    // Default to hitting the base URL directly when healthCheckPath is null/empty.
    final healthCheckUrl = (healthCheckPath == null || healthCheckPath.isEmpty)
        ? ''
        : healthCheckPath;
    final futures = endpoints.map((endpoint) => _checkEndpointHealth(
          endpoint,
          healthCheckUrl,
          timeout,
        ));

    final results = await Future.wait(futures);

    // Always log a detailed health report for debugging
    _logHealthReport(
      contextLabel: 'parallel',
      healthCheckUrl: healthCheckUrl,
      results: results,
    );

    final healthyEndpoints = <EndpointHealthResult>[];

    for (final result in results) {
      if (result.isHealthy) {
        healthyEndpoints.add(result);
      }
    }

    if (healthyEndpoints.isEmpty) {
      debugPrint('⚠️ MultiEndpointDiscovery: No healthy endpoints found');
      return null;
    }

    // Select the fastest healthy endpoint (by priority first, then response time)
    healthyEndpoints.sort((a, b) {
      final priorityCompare =
          a.endpoint.priority.compareTo(b.endpoint.priority);
      if (priorityCompare != 0) return priorityCompare;
      return a.responseTime.compareTo(b.responseTime);
    });

    _selectedEndpoint = healthyEndpoints.first.endpoint;
    debugPrint(
        '✅ MultiEndpointDiscovery: Selected endpoint: ${_selectedEndpoint!.id} (${healthyEndpoints.first.responseTime.inMilliseconds}ms)');
    return _selectedEndpoint;
  }

  /// Sequential scan (slower but more reliable)
  Future<EndpointConfig?> _sequentialScan(
    List<EndpointConfig> endpoints,
    String? healthCheckPath,
    Duration timeout,
  ) async {
    final healthCheckUrl = (healthCheckPath == null || healthCheckPath.isEmpty)
        ? ''
        : healthCheckPath;
    final results = <EndpointHealthResult>[];

    for (final endpoint in endpoints) {
      final result =
          await _checkEndpointHealth(endpoint, healthCheckUrl, timeout);
      results.add(result);
      if (result.isHealthy) {
        _selectedEndpoint = endpoint;
        debugPrint(
            '✅ MultiEndpointDiscovery: Selected endpoint: ${endpoint.id} (${result.responseTime.inMilliseconds}ms)');
        _logHealthReport(
          contextLabel: 'sequential',
          healthCheckUrl: healthCheckUrl,
          results: results,
        );
        return endpoint;
      }
    }

    // Log full report when no endpoint is healthy
    _logHealthReport(
      contextLabel: 'sequential',
      healthCheckUrl: healthCheckUrl,
      results: results,
    );

    debugPrint('⚠️ MultiEndpointDiscovery: No healthy endpoints found');
    return null;
  }

  /// Check health of a single endpoint
  Future<EndpointHealthResult> _checkEndpointHealth(
    EndpointConfig endpoint,
    String healthCheckPath,
    Duration timeout,
  ) async {
    final stopwatch = Stopwatch()..start();
    final fullUrl = endpoint.buildFullUrl(path: healthCheckPath);

    try {
      final response = await _dio
          .get(
            fullUrl,
            options: Options(
              receiveTimeout: timeout,
              sendTimeout: timeout,
              validateStatus: (status) => status != null && status < 500,
            ),
          )
          .timeout(timeout);

      stopwatch.stop();
      final statusCode = response.statusCode ?? 0;
      // Treat any 2xx–4xx response as "reachable"; only 5xx and network errors are considered unhealthy.
      final isHealthy = statusCode >= 200 && statusCode < 500;

      final result = EndpointHealthResult(
        endpoint: endpoint,
        isHealthy: isHealthy,
        responseTime: stopwatch.elapsed,
        error: isHealthy ? null : 'HTTP ${response.statusCode}',
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

  /// Get health status of all endpoints
  Map<String, EndpointHealthResult> getHealthStatus() {
    return Map.unmodifiable(_healthCache);
  }

  /// Force refresh health check for all endpoints
  Future<void> refreshHealthCheck({
    String? healthCheckPath,
    Duration timeout = const Duration(seconds: 3),
  }) async {
    _healthCache.clear();
    await discoverAvailableEndpoint(
      healthCheckPath: healthCheckPath,
      timeout: timeout,
    );
  }

  /// Get the best available endpoint URL
  String? getAvailableBaseUrl({String? path}) {
    return _selectedEndpoint?.buildFullUrl(path: path);
  }

  /// Log a detailed health report for all tested endpoints
  void _logHealthReport({
    required String contextLabel,
    required String healthCheckUrl,
    required List<EndpointHealthResult> results,
  }) {
    if (results.isEmpty) {
      debugPrint(
          '🔍 MultiEndpointDiscovery [$contextLabel]: No endpoints were tested.');
      return;
    }

    debugPrint(
        '🔍 MultiEndpointDiscovery [$contextLabel]: Health check report for "$healthCheckUrl":');

    for (final result in results) {
      final endpoint = result.endpoint;
      final fullUrl = endpoint.buildFullUrl(path: healthCheckUrl);
      final status = result.isHealthy ? 'OK' : 'FAIL';
      final timeMs = result.responseTime.inMilliseconds;
      final error = result.error ?? '-';

      debugPrint(
        '  • id=${endpoint.id}, url=$fullUrl, status=$status, '
        'time=${timeMs}ms, error=$error',
      );
    }
  }

  /// Reset discovery state
  void reset() {
    _selectedEndpoint = null;
    _healthCache.clear();
  }
}
