import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import '../models/api_response.dart';
import 'network_models.dart';
import '../../cache_manager/cache_manager.dart';

/// Unified Network Client Interface
/// Replaces multiple scattered HTTP clients with single consistent interface
abstract class NetworkClient {
  Future<NetworkResponse<T>> request<T>(NetworkRequest request);
  Future<void> dispose();
}

/// Robust Network Client Implementation
/// Combines all networking features in one unified client
class RobustNetworkClient implements NetworkClient {
  final NetworkRetryManager _retryManager;
  final NetworkRequestQueue _requestQueue;
  final OfflineRequestManager _offlineManager;
  final CacheManager _cacheManager;
  final ConnectivityMonitor _connectivityMonitor;

  bool _isDisposed = false;

  RobustNetworkClient({
    NetworkRetryManager? retryManager,
    NetworkRequestQueue? requestQueue,
    OfflineRequestManager? offlineManager,
    CacheManager? cacheManager,
    ConnectivityMonitor? connectivityMonitor,
  })  : _retryManager = retryManager ?? NetworkRetryManager(),
        _requestQueue = requestQueue ?? NetworkRequestQueue(),
        _offlineManager = offlineManager ?? OfflineRequestManager(),
        _cacheManager = cacheManager ?? CacheManager.instance,
        _connectivityMonitor = connectivityMonitor ?? ConnectivityMonitor();

  @override
  Future<NetworkResponse<T>> request<T>(NetworkRequest request) async {
    if (_isDisposed) {
      throw StateError('NetworkClient has been disposed');
    }

    final cacheKey = _generateCacheKey(request);

    // Step 1: Cache-first strategy for GET requests
    if (request.method == 'GET' && request.enableCache) {
      final cachedResponse = await _cacheManager.getNetworkResponse<T>(cacheKey);
      if (cachedResponse != null && !_isCacheStale(cachedResponse, request.cacheStaleTime)) {
        debugPrint('Cache hit: ${request.endpoint}');
        return cachedResponse;
      }
    }

    // Step 2: Queue request with priority
    return await _requestQueue.enqueue<T>(
      () => _executeRequestWithFallback<T>(request, cacheKey),
      priority: request.priority,
    );
  }

  Future<NetworkResponse<T>> _executeRequestWithFallback<T>(
    NetworkRequest request,
    String cacheKey
  ) async {
    try {
      // Step 3: Execute with smart retry
      final response = await _retryManager.executeWithNetworkAwareness<T>(
        () => _performHttpRequest<T>(request),
        request: request,
      );

      // Step 4: Update cache on success
      if (request.enableCache && request.method == 'GET') {
        await _cacheManager.storeNetworkResponse(cacheKey, response);
      }

      return response;
    } catch (e) {
      // Step 5: Handle network failure
      return await _handleNetworkFailure<T>(request, cacheKey, e);
    }
  }

  Future<NetworkResponse<T>> _handleNetworkFailure<T>(
    NetworkRequest request,
    String cacheKey,
    dynamic error,
  ) async {
    // Try stale cache first
    if (request.enableCache) {
      final staleCache = await _cacheManager.getNetworkResponse<T>(cacheKey);
      if (staleCache != null) {
        debugPrint('Network failed, returning stale cache: ${request.endpoint}');
        return staleCache.copyWith(isStale: true, error: error.toString());
      }
    }

    // Queue for offline if allowed
    if (request.allowOffline) {
      await _offlineManager.queueRequest(request);
      return NetworkResponse<T>.offline(
        message: 'Request queued for when network is available',
        originalError: error.toString(),
      );
    }

    throw error;
  }

  Future<NetworkResponse<T>> _performHttpRequest<T>(NetworkRequest request) async {
    // Actual HTTP implementation would go here
    // This is a placeholder that delegates to the appropriate HTTP client
    throw UnimplementedError('HTTP implementation needed');
  }

  String _generateCacheKey(NetworkRequest request) {
    // Generate deterministic cache key
    final params = request.parameters?.entries
        .toList()
        ..sort((a, b) => a.key.compareTo(b.key));

    final paramString = params?.map((e) => '${e.key}=${e.value}').join('&') ?? '';
    return '${request.method}_${request.endpoint}_$paramString';
  }

  bool _isCacheStale(NetworkResponse response, Duration? staleTime) {
    if (staleTime == null) return false;
    return DateTime.now().difference(response.timestamp) > staleTime;
  }

  @override
  Future<void> dispose() async {
    if (_isDisposed) return;

    _isDisposed = true;
    await _requestQueue.dispose();
    await _offlineManager.dispose();
    _cacheManager.dispose();
    await _connectivityMonitor.dispose();
    await _retryManager.dispose();
  }
}

/// Network request model with all configuration options
class NetworkRequest {
  final String endpoint;
  final String method;
  final Map<String, dynamic>? parameters;
  final Map<String, String>? headers;
  final dynamic body;
  final RequestPriority priority;
  final bool enableCache;
  final bool allowOffline;
  final Duration? timeout;
  final Duration? cacheStaleTime;
  final int? maxRetries;

  const NetworkRequest({
    required this.endpoint,
    this.method = 'GET',
    this.parameters,
    this.headers,
    this.body,
    this.priority = RequestPriority.normal,
    this.enableCache = true,
    this.allowOffline = true,
    this.timeout,
    this.cacheStaleTime,
    this.maxRetries,
  });

  NetworkRequest copyWith({
    String? endpoint,
    String? method,
    Map<String, dynamic>? parameters,
    Map<String, String>? headers,
    dynamic body,
    RequestPriority? priority,
    bool? enableCache,
    bool? allowOffline,
    Duration? timeout,
    Duration? cacheStaleTime,
    int? maxRetries,
  }) {
    return NetworkRequest(
      endpoint: endpoint ?? this.endpoint,
      method: method ?? this.method,
      parameters: parameters ?? this.parameters,
      headers: headers ?? this.headers,
      body: body ?? this.body,
      priority: priority ?? this.priority,
      enableCache: enableCache ?? this.enableCache,
      allowOffline: allowOffline ?? this.allowOffline,
      timeout: timeout ?? this.timeout,
      cacheStaleTime: cacheStaleTime ?? this.cacheStaleTime,
      maxRetries: maxRetries ?? this.maxRetries,
    );
  }
}

/// Network response model with enhanced metadata
class NetworkResponse<T> {
  final T? data;
  final int statusCode;
  final String? message;
  final Map<String, String>? headers;
  final DateTime timestamp;
  final bool isStale;
  final bool isFromCache;
  final bool isOffline;
  final String? error;

  const NetworkResponse({
    this.data,
    required this.statusCode,
    this.message,
    this.headers,
    required this.timestamp,
    this.isStale = false,
    this.isFromCache = false,
    this.isOffline = false,
    this.error,
  });

  factory NetworkResponse.success(T data, {
    int statusCode = 200,
    String? message,
    Map<String, String>? headers,
    bool isFromCache = false,
  }) {
    return NetworkResponse<T>(
      data: data,
      statusCode: statusCode,
      message: message,
      headers: headers,
      timestamp: DateTime.now(),
      isFromCache: isFromCache,
    );
  }

  factory NetworkResponse.offline({
    String? message,
    String? originalError,
  }) {
    return NetworkResponse<T>(
      statusCode: 0,
      message: message ?? 'Request queued for offline execution',
      timestamp: DateTime.now(),
      isOffline: true,
      error: originalError,
    );
  }

  NetworkResponse<T> copyWith({
    T? data,
    int? statusCode,
    String? message,
    Map<String, String>? headers,
    DateTime? timestamp,
    bool? isStale,
    bool? isFromCache,
    bool? isOffline,
    String? error,
  }) {
    return NetworkResponse<T>(
      data: data ?? this.data,
      statusCode: statusCode ?? this.statusCode,
      message: message ?? this.message,
      headers: headers ?? this.headers,
      timestamp: timestamp ?? this.timestamp,
      isStale: isStale ?? this.isStale,
      isFromCache: isFromCache ?? this.isFromCache,
      isOffline: isOffline ?? this.isOffline,
      error: error ?? this.error,
    );
  }

  bool get isSuccess => statusCode >= 200 && statusCode < 300;
  bool get hasError => error != null;
}