import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/network_config.dart';
import '../core/network_models.dart';
import '../client/network_client.dart';
import '../endpoints/endpoint_config.dart';
import '../auth/auth_manager.dart';
import '../cache/cache_manager.dart';
import '../loading/loading_manager.dart';

/// Advanced network service base class for sub-applications
abstract class AdvancedNetworkService extends ChangeNotifier {
  final NetworkClient _client = NetworkClient.instance;
  final AuthManager _authManager = AuthManager.instance;
  final CacheManager _cacheManager = CacheManager.instance;
  final LoadingManager _loadingManager = LoadingManager.instance;

  /// Endpoint configuration for this service
  EndpointConfig get endpointConfig;

  /// Service name for logging and identification
  String get serviceName;

  /// Initialize service
  Future<void> initialize() async {
    await _client.initialize();
    
    // Validate endpoint configuration
    final errors = endpointConfig.validate();
    if (errors.isNotEmpty) {
      debugPrint('⚠️ Endpoint configuration errors for $serviceName:');
      for (final error in errors) {
        debugPrint('   - $error');
      }
    }
    
    debugPrint('✅ $serviceName initialized');
  }

  /// Make a request using endpoint name
  Future<NetworkResponse<T>> request<T>(
    String endpointName, {
    Map<String, dynamic>? queryParameters,
    dynamic data,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    Function(int received, int total)? onReceiveProgress,
    CancelToken? cancelToken,
  }) async {
    final endpoint = endpointConfig.getEndpoint(endpointName);
    if (endpoint == null) {
      return NetworkResponse.error<T>(
        requestId: requestId ?? 'unknown',
        statusCode: 400,
        message: 'Endpoint $endpointName not found in $serviceName',
        error: NetworkError(
          type: NetworkErrorType.validation,
          message: 'Endpoint not found',
        ),
      );
    }

    final request = endpoint.createRequest(
      queryParameters: queryParameters,
      data: data,
      additionalHeaders: headers,
      pathParams: pathParams,
      config: endpointConfig,
      requestId: requestId,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
      cancelToken: cancelToken,
    );

    return await _client.request<T>(request);
  }

  /// Make a GET request
  Future<NetworkResponse<T>> get<T>(
    String endpointName, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    CancelToken? cancelToken,
  }) async {
    return await request<T>(
      endpointName,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      cancelToken: cancelToken,
    );
  }

  /// Make a POST request
  Future<NetworkResponse<T>> post<T>(
    String endpointName, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    return await request<T>(
      endpointName,
      data: data,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );
  }

  /// Make a PUT request
  Future<NetworkResponse<T>> put<T>(
    String endpointName, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    return await request<T>(
      endpointName,
      data: data,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );
  }

  /// Make a PATCH request
  Future<NetworkResponse<T>> patch<T>(
    String endpointName, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    return await request<T>(
      endpointName,
      data: data,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );
  }

  /// Make a DELETE request
  Future<NetworkResponse<T>> delete<T>(
    String endpointName, {
    Map<String, dynamic>? queryParameters,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? requestId,
    CancelToken? cancelToken,
  }) async {
    return await request<T>(
      endpointName,
      queryParameters: queryParameters,
      headers: headers,
      pathParams: pathParams,
      requestId: requestId,
      cancelToken: cancelToken,
    );
  }

  /// Execute multiple requests in parallel
  Future<List<NetworkResponse<dynamic>>> parallel(
    List<ParallelRequest> requests,
  ) async {
    final futures = requests.map((req) => request<dynamic>(
      req.endpointName,
      queryParameters: req.queryParameters,
      data: req.data,
      headers: req.headers,
      pathParams: req.pathParams,
      requestId: req.requestId,
      onSendProgress: req.onSendProgress,
      onReceiveProgress: req.onReceiveProgress,
      cancelToken: req.cancelToken,
    )).toList();

    return await Future.wait(futures);
  }

  /// Execute requests in sequence
  Future<List<NetworkResponse<dynamic>>> sequence(
    List<ParallelRequest> requests,
  ) async {
    final results = <NetworkResponse<dynamic>>[];

    for (final req in requests) {
      final response = await request<dynamic>(
        req.endpointName,
        queryParameters: req.queryParameters,
        data: req.data,
        headers: req.headers,
        pathParams: req.pathParams,
        requestId: req.requestId,
        onSendProgress: req.onSendProgress,
        onReceiveProgress: req.onReceiveProgress,
        cancelToken: req.cancelToken,
      );
      
      results.add(response);
      
      // Stop on first error if specified
      if (!response.isSuccess && req.stopOnError) {
        break;
      }
    }

    return results;
  }

  /// Execute with automatic retry and exponential backoff
  Future<NetworkResponse<T>> withRetry<T>(
    String endpointName, {
    Map<String, dynamic>? queryParameters,
    dynamic data,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    int maxRetries = 3,
    Duration initialDelay = const Duration(seconds: 1),
    double backoffMultiplier = 2.0,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    Function(int received, int total)? onReceiveProgress,
    CancelToken? cancelToken,
  }) async {
    NetworkResponse<T>? lastResponse;
    Duration currentDelay = initialDelay;

    for (int attempt = 0; attempt <= maxRetries; attempt++) {
      lastResponse = await request<T>(
        endpointName,
        queryParameters: queryParameters,
        data: data,
        headers: headers,
        pathParams: pathParams,
        requestId: requestId,
        onSendProgress: onSendProgress,
        onReceiveProgress: onReceiveProgress,
        cancelToken: cancelToken,
      );

      if (lastResponse.isSuccess || attempt == maxRetries) {
        break;
      }

      // Wait before retry
      await Future.delayed(currentDelay);
      currentDelay = Duration(
        milliseconds: (currentDelay.inMilliseconds * backoffMultiplier).round(),
      );
    }

    return lastResponse!;
  }

  /// Execute with loading state management
  Future<NetworkResponse<T>> withLoading<T>(
    String endpointName, {
    Map<String, dynamic>? queryParameters,
    dynamic data,
    Map<String, String>? headers,
    Map<String, dynamic>? pathParams,
    String? loadingMessage,
    LoadingType loadingType = LoadingType.request,
    String? requestId,
    Function(int sent, int total)? onSendProgress,
    Function(int received, int total)? onReceiveProgress,
    CancelToken? cancelToken,
  }) async {
    return await _loadingManager.withLoading<NetworkResponse<T>>(
      () => request<T>(
        endpointName,
        queryParameters: queryParameters,
        data: data,
        headers: headers,
        pathParams: pathParams,
        requestId: requestId,
        onSendProgress: onSendProgress,
        onReceiveProgress: onReceiveProgress,
        cancelToken: cancelToken,
      ),
      requestId: requestId,
      message: loadingMessage,
      type: loadingType,
    );
  }

  /// Get cached response
  Future<T?> getCached<T>(String cacheKey) async {
    return await _cacheManager.retrieve<T>(cacheKey);
  }

  /// Clear cache for specific key
  Future<void> clearCache(String cacheKey) async {
    await _cacheManager.remove(cacheKey);
  }

  /// Clear all cache for this service
  Future<void> clearAllCache() async {
    // Implementation would need service-specific cache key patterns
    await _cacheManager.clear();
  }

  /// Check authentication status
  bool get isAuthenticated => _authManager.isAuthenticated;

  /// Get authentication summary
  Map<String, dynamic> get authSummary => _authManager.getAuthSummary();

  /// Get service statistics
  Future<Map<String, dynamic>> getStats() async {
    return {
      'serviceName': serviceName,
      'endpointCount': endpointConfig.endpoints.length,
      'groupCount': endpointConfig.groups.length,
      'isAuthenticated': isAuthenticated,
      'cache': await _cacheManager.getStats(),
      'loading': _loadingManager.getStats(),
    };
  }

  /// Dispose resources
  @override
  void dispose() {
    super.dispose();
  }
}

/// Parallel request configuration
class ParallelRequest {
  final String endpointName;
  final Map<String, dynamic>? queryParameters;
  final dynamic data;
  final Map<String, String>? headers;
  final Map<String, dynamic>? pathParams;
  final String? requestId;
  final Function(int sent, int total)? onSendProgress;
  final Function(int received, int total)? onReceiveProgress;
  final CancelToken? cancelToken;
  final bool stopOnError;

  const ParallelRequest({
    required this.endpointName,
    this.queryParameters,
    this.data,
    this.headers,
    this.pathParams,
    this.requestId,
    this.onSendProgress,
    this.onReceiveProgress,
    this.cancelToken,
    this.stopOnError = false,
  });
}
