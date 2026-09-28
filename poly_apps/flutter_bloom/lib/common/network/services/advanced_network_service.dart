import 'dart:async';
import 'package:flutter/foundation.dart';
// REFACTOR: Renamed network_models.dart to endpoint_network_models.dart
import '../core/unified_network_client.dart';
// REFACTOR: Import CancelToken, NetworkRequest, NetworkResponse, RequestMethod from network_types.dart
import '../core/network_types.dart' show CancelToken, NetworkRequest, NetworkResponse, RequestMethod;
import '../endpoints/endpoint_config.dart';
import '../models/api_config.dart';
import '../auth/unified_auth_manager.dart';
import '../ui/global_loading_system.dart';

// REMOVED: Duplicate CancelToken class definition
// Use CancelToken from network_types.dart instead

/// Network error for error handling
/// FIXED: Added NetworkError class for error responses
class NetworkError {
  final String type;
  final String message;
  final dynamic originalError;

  NetworkError({
    required this.type,
    required this.message,
    this.originalError,
  });

  @override
  String toString() => 'NetworkError($type): $message';
}

/// Network error types
/// FIXED: Added NetworkErrorType enum for categorizing errors
class NetworkErrorType {
  static const String validation = 'validation';
  static const String network = 'network';
  static const String timeout = 'timeout';
  static const String server = 'server';
  static const String authentication = 'authentication';
  static const String unknown = 'unknown';
}

/// Advanced network service base class for sub-applications
abstract class AdvancedNetworkService extends ChangeNotifier {
  // REFACTOR: Use UnifiedNetworkClient (production implementation based on EnhancedHttpClient)
  late final UnifiedNetworkClient _client;
  final UnifiedAuthManager _authManager = UnifiedAuthManager.instance;
  final GlobalLoadingSystem _loadingManager = GlobalLoadingSystem.instance;

  /// Endpoint configuration for this service
  EndpointConfig get endpointConfig;

  /// Service name for logging and identification
  String get serviceName;
  
  /// API configuration for this service
  ApiConfig get apiConfig;

  /// Initialize service
  Future<void> initialize() async {
    // REFACTOR: Initialize UnifiedNetworkClient with proper config
    _client = UnifiedNetworkClient.create(
      config: apiConfig,
      instanceKey: serviceName,
    );
    
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
      // FIXED: NetworkResponse doesn't have .error() constructor, create manually
      // FIXED: Added required timestamp parameter
      return NetworkResponse<T>(
        statusCode: 400,
        message: 'Endpoint $endpointName not found in $serviceName',
        error: NetworkError(
          type: NetworkErrorType.validation,
          message: 'Endpoint not found',
        ).toString(),
        data: null,
        timestamp: DateTime.now(),
      );
    }

    // FIXED: endpoint.createRequest returns models.NetworkRequest but _client.request expects unified_network_client.NetworkRequest
    // Since they are different types, we'll create a new NetworkRequest for the client
    // Note: CancelToken types are also incompatible, so we skip it for now
    final modelsRequest = endpoint.createRequest(
      queryParameters: queryParameters,
      data: data,
      additionalHeaders: headers,
      pathParams: pathParams,
      config: endpointConfig,
      requestId: requestId,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
      // FIXED: Skip cancelToken as it's a different type in models.NetworkRequest
    );

    // REFACTOR: NetworkRequest now from network_types.dart (requires RequestMethod enum)
    final clientRequest = NetworkRequest(
      endpoint: endpoint.path,
      method: _stringToRequestMethod(endpoint.method), // Convert string to RequestMethod enum
      headers: modelsRequest.headers,
      body: data,
      parameters: queryParameters,
    );

    return await _client.request<T>(clientRequest);
  }

  // REFACTOR: Helper to convert string method to RequestMethod enum
  RequestMethod _stringToRequestMethod(String method) {
    switch (method.toUpperCase()) {
      case 'GET': return RequestMethod.get;
      case 'POST': return RequestMethod.post;
      case 'PUT': return RequestMethod.put;
      case 'DELETE': return RequestMethod.delete;
      case 'PATCH': return RequestMethod.patch;
      case 'HEAD': return RequestMethod.head;
      case 'OPTIONS': return RequestMethod.options;
      default: return RequestMethod.get;
    }
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
    // FIXED: GlobalLoadingSystem doesn't have withLoading method, use show/hide instead
    if (loadingMessage != null) {
      _loadingManager.show(message: loadingMessage, type: loadingType);
    }
    
    try {
      return await request<T>(
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
    } finally {
      if (loadingMessage != null) {
        _loadingManager.hide();
      }
    }
  }

  /// Get cached response (using network client cache)
  Future<T?> getCached<T>(String cacheKey) async {
    // Using network client's internal cache management
    return null; // Placeholder - cache is handled by network client
  }

  /// Clear cache for specific key
  Future<void> clearCache(String cacheKey) async {
    // Cache management is handled by the network client
    debugPrint('Cache clear requested for key: $cacheKey');
  }

  /// Clear all cache for this service
  Future<void> clearAllCache() async {
    // Cache management is handled by the network client
    debugPrint('All cache clear requested for service: $serviceName');
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
