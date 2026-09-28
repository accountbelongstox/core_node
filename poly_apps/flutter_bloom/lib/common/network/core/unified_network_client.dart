/// Unified Network Client - Production Implementation
/// 
/// This is the primary HTTP client for the application, based on EnhancedHttpClient
/// with simplified API compatible with NetworkClient interface.
/// 
/// Features:
/// - Full HTTP support (GET, POST, PUT, DELETE, PATCH)
/// - Interceptor support (Auth, Error, Logging)
/// - Timeout and retry handling
/// - Network connectivity check
/// - Type-safe response handling
library;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'network_types.dart' as network_types;
import '../models/api_config.dart';
import '../utils/network_utils.dart';
import '../interceptors/auth_interceptor.dart';
import '../interceptors/network_interceptors.dart';
import 'api_endpoint_manager.dart';
import 'endpoint_network_models.dart' as endpoint_models;

/// Unified Network Client - Production-ready HTTP client
/// 
/// Features:
/// - Automatic authentication header injection via AuthInterceptor
/// - Token refresh on 401 responses
/// - Network connectivity check
/// - Request/response logging
/// - Type-safe responses
class UnifiedNetworkClient implements network_types.NetworkClient {
  final ApiConfig config;
  final http.Client _httpClient;
  final NetworkUtils _networkUtils;
  final AuthInterceptor _authInterceptor;
  final NetworkInterceptors _networkInterceptors = NetworkInterceptors.instance;
  
  bool _isDisposed = false;
  static final Map<String, UnifiedNetworkClient> _instances = {};
  
  UnifiedNetworkClient._({
    required this.config,
    http.Client? httpClient,
    NetworkUtils? networkUtils,
    AuthInterceptor? authInterceptor,
  }) : _httpClient = httpClient ?? http.Client(),
       _networkUtils = networkUtils ?? NetworkUtils.instance,
       _authInterceptor = authInterceptor ?? AuthInterceptor.instance;

  /// Factory constructor with instance caching
  factory UnifiedNetworkClient.create({
    required ApiConfig config,
    String? instanceKey,
    http.Client? httpClient,
    NetworkUtils? networkUtils,
    AuthInterceptor? authInterceptor,
  }) {
    final key = instanceKey ?? config.baseUrl;
    
    if (_instances.containsKey(key)) {
      return _instances[key]!;
    }
    
    final client = UnifiedNetworkClient._(
      config: config,
      httpClient: httpClient,
      networkUtils: networkUtils,
      authInterceptor: authInterceptor,
    );
    
    _instances[key] = client;
    return client;
  }

  @override
  Future<network_types.NetworkResponse<T>> request<T>(network_types.NetworkRequest request) async {
    if (_isDisposed) {
      throw StateError('NetworkClient has been disposed');
    }

    return await _makeRequestWithAuth<T>(request, isRetry: false);
  }
  
  /// Make request with authentication and auto-retry on 401
  Future<network_types.NetworkResponse<T>> _makeRequestWithAuth<T>(
    network_types.NetworkRequest request, {
    required bool isRetry,
  }) async {
    // Check network connectivity
    if (!_networkUtils.isConnected) {
      final endpointErrorResponse = endpoint_models.NetworkResponse<T>.error(
        requestId: request.metadata?['id'] as String? ?? _generateRequestId(),
        statusCode: 0,
        message: 'No network connection',
        error: endpoint_models.NetworkError.connection(message: 'No network connection'),
      );
      await _networkInterceptors.processResponse<T>(endpointErrorResponse);
      return _convertToNetworkTypesResponse<T>(endpointErrorResponse);
    }

    final stopwatch = Stopwatch()..start();
    final endpointNetworkRequest = _convertToEndpointNetworkRequest(request);
    endpoint_models.NetworkRequest processedRequest = endpointNetworkRequest;
    endpoint_models.NetworkResponse<T>? processedResponse;

    try {
      // Process request through interceptors
      processedRequest = await _networkInterceptors.processRequest(endpointNetworkRequest);
      
      // Build URL
      final uri = _buildUri(processedRequest.path, processedRequest.queryParameters);
      
      // Build headers with authentication
      final headers = await _buildHeaders(processedRequest);
      
      // Log request
      if (config.enableLogging) {
        debugPrint('→ ${processedRequest.method.toUpperCase()} ${uri.toString()}');
        if (_authInterceptor.isAuthenticated()) {
          debugPrint('   🔐 Authenticated request');
        }
      }
      
      // Make HTTP request
      final requestMethod = _stringToRequestMethod(processedRequest.method);
      final httpResponse = await _makeHttpRequest(uri, requestMethod, headers, processedRequest.data, processedRequest.timeout);
      stopwatch.stop();
      
      // Parse response
      final parsedResponse = _parseResponse<T>(httpResponse, processedRequest.id, stopwatch.elapsed);
      
      // Process response through interceptors
      processedResponse = await _networkInterceptors.processResponse<T>(parsedResponse);
      
      // Log response
      if (config.enableLogging) {
        debugPrint('← ${processedResponse.statusCode} ${uri.toString()}');
      }
      
      // Handle 401 Unauthorized - Auto refresh token and retry
      if (processedResponse.statusCode == 401 && !isRetry) {
        debugPrint('⚠️  Received 401 Unauthorized, attempting token refresh...');
        
        final refreshSuccess = await _authInterceptor.refreshToken();
        
        if (refreshSuccess) {
          debugPrint('✅ Token refreshed, retrying request...');
          // Retry request with new token
          return await _makeRequestWithAuth<T>(request, isRetry: true);
        } else {
          debugPrint('❌ Token refresh failed, request aborted');
          _authInterceptor.onAuthError();
        }
      }
      
      return _convertToNetworkTypesResponse<T>(processedResponse);
      
    } catch (e) {
      stopwatch.stop();
      debugPrint('Network request failed: $e');
      
      final errorResponse = endpoint_models.NetworkResponse<T>.error(
        requestId: processedRequest.id,
        statusCode: 500,
        message: e.toString(),
        error: endpoint_models.NetworkError.unknown(message: e.toString()),
        duration: stopwatch.elapsed,
      );
      
      final processedErrorResponse = await _networkInterceptors.processResponse<T>(errorResponse);
      return _convertToNetworkTypesResponse<T>(processedErrorResponse);
    }
  }

  /// Convert NetworkRequest (from network_types.dart) to NetworkRequest (from endpoint_network_models.dart)
  endpoint_models.NetworkRequest _convertToEndpointNetworkRequest(network_types.NetworkRequest request) {
    final requestId = request.metadata?['id'] as String? ?? _generateRequestId();
    return endpoint_models.NetworkRequest(
      id: requestId,
      method: _requestMethodToString(request.method),
      path: request.endpoint,
      queryParameters: request.parameters,
      data: request.body,
      headers: request.headers,
      timeout: request.timeout,
    );
  }

  /// Convert NetworkResponse (from endpoint_network_models.dart) to NetworkResponse (from network_types.dart)
  network_types.NetworkResponse<T> _convertToNetworkTypesResponse<T>(endpoint_models.NetworkResponse<T> response) {
    return network_types.NetworkResponse<T>(
      data: response.data,
      statusCode: response.statusCode,
      message: response.message,
      error: response.error?.message,
      headers: response.headers,
      isFromCache: response.isFromCache,
      timestamp: response.timestamp,
      latency: response.duration,
      metadata: {
        'requestId': response.requestId,
        'statusMessage': response.statusMessage,
        'errorCode': response.errorCode,
        if (response.error != null) 'errorType': response.error!.type.toString(),
      },
    );
  }

  String _generateRequestId() {
    return '${DateTime.now().millisecondsSinceEpoch}_${UniqueKey().toString()}';
  }

  String _requestMethodToString(network_types.RequestMethod method) {
    switch (method) {
      case network_types.RequestMethod.get:
        return 'GET';
      case network_types.RequestMethod.post:
        return 'POST';
      case network_types.RequestMethod.put:
        return 'PUT';
      case network_types.RequestMethod.patch:
        return 'PATCH';
      case network_types.RequestMethod.delete:
        return 'DELETE';
      case network_types.RequestMethod.head:
        return 'HEAD';
      case network_types.RequestMethod.options:
        return 'OPTIONS';
    }
  }

  network_types.RequestMethod _stringToRequestMethod(String method) {
    switch (method.toUpperCase()) {
      case 'GET':
        return network_types.RequestMethod.get;
      case 'POST':
        return network_types.RequestMethod.post;
      case 'PUT':
        return network_types.RequestMethod.put;
      case 'PATCH':
        return network_types.RequestMethod.patch;
      case 'DELETE':
        return network_types.RequestMethod.delete;
      case 'HEAD':
        return network_types.RequestMethod.head;
      case 'OPTIONS':
        return network_types.RequestMethod.options;
      default:
        return network_types.RequestMethod.get;
    }
  }

  Uri _buildUri(String endpoint, Map<String, dynamic>? parameters) {
    String effectiveBaseUrl;
    
    final endpointManager = ApiEndpointManager();
    final dynamicBaseUrl = endpointManager.getCurrentBaseUrl();
    
    if (dynamicBaseUrl != null) {
      effectiveBaseUrl = dynamicBaseUrl;
    } else {
      effectiveBaseUrl = config.baseUrl;
    }
    
    effectiveBaseUrl = effectiveBaseUrl.endsWith('/') 
        ? effectiveBaseUrl.substring(0, effectiveBaseUrl.length - 1)
        : effectiveBaseUrl;
    
    final path = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    final fullUrl = '$effectiveBaseUrl$path';
    
    if (parameters != null && parameters.isNotEmpty) {
      return Uri.parse(fullUrl).replace(queryParameters: 
        parameters.map((key, value) => MapEntry(key, value.toString()))
      );
    }
    
    return Uri.parse(fullUrl);
  }

  Future<Map<String, String>> _buildHeaders(endpoint_models.NetworkRequest endpointRequest) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config.defaultHeaders,
    };
    
    // Add custom headers from request
    if (endpointRequest.headers != null) {
      headers.addAll(endpointRequest.headers!);
    }
    
    // INTEGRATED: Add authentication headers via AuthInterceptor
    // This automatically handles:
    // - Bearer token injection
    // - Token expiry check
    // - Auto refresh if needed
    final authHeaders = await _authInterceptor.getAuthHeaders();
    headers.addAll(authHeaders);
    
    return headers;
  }

  Future<http.Response> _makeHttpRequest(
    Uri uri,
    network_types.RequestMethod method,
    Map<String, String> headers,
    dynamic body,
    Duration? timeout,
  ) async {
    final effectiveTimeout = timeout ?? Duration(seconds: config.timeoutSeconds);
    
    Future<http.Response> requestFuture;
    
    switch (method) {
      case network_types.RequestMethod.get:
        requestFuture = _httpClient.get(uri, headers: headers);
        break;
      case network_types.RequestMethod.post:
        requestFuture = _httpClient.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case network_types.RequestMethod.put:
        requestFuture = _httpClient.put(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case network_types.RequestMethod.delete:
        requestFuture = _httpClient.delete(uri, headers: headers);
        break;
      case network_types.RequestMethod.patch:
        requestFuture = _httpClient.patch(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case network_types.RequestMethod.head:
        requestFuture = _httpClient.head(uri, headers: headers);
        break;
      case network_types.RequestMethod.options:
        // http package doesn't have options, use generic request
        requestFuture = _httpClient.send(http.Request('OPTIONS', uri)..headers.addAll(headers))
            .then((streamedResponse) => http.Response.fromStream(streamedResponse));
        break;
    }
    
    return await requestFuture.timeout(effectiveTimeout);
  }

  endpoint_models.NetworkResponse<T> _parseResponse<T>(http.Response response, String requestId, Duration duration) {
    final isSuccess = response.statusCode >= 200 && response.statusCode < 300;
    
    dynamic data;
    String? errorMessage;
    Map<String, dynamic>? rawData;
    
    if (response.body.isNotEmpty) {
      try {
        data = jsonDecode(response.body);
        rawData = data is Map<String, dynamic> ? data : {'body': response.body};
      } catch (e) {
        // If JSON parsing fails, use raw body
        data = response.body;
        rawData = {'body': response.body};
      }
    }
    
    if (!isSuccess) {
      errorMessage = _extractErrorMessage(data) ?? 'Request failed with status ${response.statusCode}';
    }
    
    if (isSuccess) {
      return endpoint_models.NetworkResponse<T>.success(
        requestId: requestId,
        statusCode: response.statusCode,
        statusMessage: _getStatusMessage(response.statusCode),
        data: data as T?,
        rawData: rawData,
        headers: response.headers,
        message: 'Success',
        timestamp: DateTime.now(),
        duration: duration,
      );
    } else {
      return endpoint_models.NetworkResponse<T>.error(
        requestId: requestId,
        statusCode: response.statusCode,
        statusMessage: _getStatusMessage(response.statusCode),
        rawData: rawData,
        headers: response.headers,
        message: errorMessage,
        error: endpoint_models.NetworkError.server(
          statusCode: response.statusCode,
          message: errorMessage ?? 'Request failed',
        ),
        timestamp: DateTime.now(),
        duration: duration,
      );
    }
  }

  String? _getStatusMessage(int statusCode) {
    switch (statusCode) {
      case 200:
        return 'OK';
      case 201:
        return 'Created';
      case 400:
        return 'Bad Request';
      case 401:
        return 'Unauthorized';
      case 403:
        return 'Forbidden';
      case 404:
        return 'Not Found';
      case 500:
        return 'Internal Server Error';
      default:
        return null;
    }
  }

  String? _extractErrorMessage(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data['error']?.toString() ?? 
             data['message']?.toString() ?? 
             data['msg']?.toString();
    }
    return null;
  }

  // ==================== Authentication Methods ====================
  
  /// Set authentication tokens
  /// This is a convenience method to set tokens in the AuthInterceptor
  void setAuthTokens({
    required String accessToken,
    String? refreshToken,
    DateTime? expiry,
  }) {
    _authInterceptor.setTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiry: expiry,
    );
  }
  
  /// Clear authentication tokens
  void clearAuthTokens() {
    _authInterceptor.clearTokens();
  }
  
  /// Check if user is authenticated
  bool get isAuthenticated => _authInterceptor.isAuthenticated();
  
  /// Get current access token
  String? get accessToken => _authInterceptor.accessToken;
  
  /// Check if token is expired
  bool get isTokenExpired => _authInterceptor.isTokenExpired();
  
  /// Check if token will expire soon (within 5 minutes)
  bool get isTokenExpiringSoon => _authInterceptor.isTokenExpiringSoon();
  
  /// Manually trigger token refresh
  Future<bool> refreshToken() => _authInterceptor.refreshToken();
  
  // ==================== Lifecycle Methods ====================
  
  @override
  Future<void> dispose() async {
    if (_isDisposed) return;
    _isDisposed = true;
    _httpClient.close();
  }
  
  /// Clear all cached instances
  static void clearInstances() {
    for (final instance in _instances.values) {
      instance.dispose();
    }
    _instances.clear();
  }
}

