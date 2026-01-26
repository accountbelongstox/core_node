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
import 'network_types.dart';
import '../models/api_config.dart';
import '../utils/network_utils.dart';
import '../interceptors/auth_interceptor.dart';
import 'api_endpoint_manager.dart';

/// Unified Network Client - Production-ready HTTP client
/// 
/// Features:
/// - Automatic authentication header injection via AuthInterceptor
/// - Token refresh on 401 responses
/// - Network connectivity check
/// - Request/response logging
/// - Type-safe responses
class UnifiedNetworkClient implements NetworkClient {
  final ApiConfig config;
  final http.Client _httpClient;
  final NetworkUtils _networkUtils;
  final AuthInterceptor _authInterceptor;
  
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
  Future<NetworkResponse<T>> request<T>(NetworkRequest request) async {
    if (_isDisposed) {
      throw StateError('NetworkClient has been disposed');
    }

    return await _makeRequestWithAuth<T>(request, isRetry: false);
  }
  
  /// Make request with authentication and auto-retry on 401
  Future<NetworkResponse<T>> _makeRequestWithAuth<T>(
    NetworkRequest request, {
    required bool isRetry,
  }) async {
    // Check network connectivity
    if (!_networkUtils.isConnected) {
      return NetworkResponse<T>(
        statusCode: 0,
        error: 'No network connection',
        data: null,
        timestamp: DateTime.now(),
      );
    }

    try {
      // Build URL
      final uri = _buildUri(request.endpoint, request.parameters);
      
      // Build headers with authentication
      final headers = await _buildHeaders(request);
      
      // Log request
      if (config.enableLogging) {
        debugPrint('→ ${request.method.name} ${uri.toString()}');
        if (_authInterceptor.isAuthenticated()) {
          debugPrint('   🔐 Authenticated request');
        }
      }
      
      // Make HTTP request
      final response = await _makeHttpRequest(uri, request.method, headers, request.body, request.timeout);
      
      // Log response
      if (config.enableLogging) {
        debugPrint('← ${response.statusCode} ${uri.toString()}');
      }
      
      // Handle 401 Unauthorized - Auto refresh token and retry
      if (response.statusCode == 401 && !isRetry) {
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
      
      // Parse response
      return _parseResponse<T>(response);
      
    } catch (e) {
      debugPrint('Network request failed: $e');
      
      return NetworkResponse<T>(
        statusCode: 500,
        error: e.toString(),
        data: null,
        timestamp: DateTime.now(),
      );
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

  Future<Map<String, String>> _buildHeaders(NetworkRequest request) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config.defaultHeaders,
    };
    
    // Add custom headers from request
    if (request.headers != null) {
      headers.addAll(request.headers!);
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
    RequestMethod method,
    Map<String, String> headers,
    dynamic body,
    Duration? timeout,
  ) async {
    final effectiveTimeout = timeout ?? Duration(seconds: config.timeoutSeconds);
    
    Future<http.Response> requestFuture;
    
    switch (method) {
      case RequestMethod.get:
        requestFuture = _httpClient.get(uri, headers: headers);
        break;
      case RequestMethod.post:
        requestFuture = _httpClient.post(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case RequestMethod.put:
        requestFuture = _httpClient.put(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case RequestMethod.delete:
        requestFuture = _httpClient.delete(uri, headers: headers);
        break;
      case RequestMethod.patch:
        requestFuture = _httpClient.patch(
          uri,
          headers: headers,
          body: body != null ? jsonEncode(body) : null,
        );
        break;
      case RequestMethod.head:
        requestFuture = _httpClient.head(uri, headers: headers);
        break;
      case RequestMethod.options:
        // http package doesn't have options, use generic request
        requestFuture = _httpClient.send(http.Request('OPTIONS', uri)..headers.addAll(headers))
            .then((streamedResponse) => http.Response.fromStream(streamedResponse));
        break;
    }
    
    return await requestFuture.timeout(effectiveTimeout);
  }

  NetworkResponse<T> _parseResponse<T>(http.Response response) {
    final isSuccess = response.statusCode >= 200 && response.statusCode < 300;
    
    dynamic data;
    String? error;
    
    if (response.body.isNotEmpty) {
      try {
        data = jsonDecode(response.body);
      } catch (e) {
        // If JSON parsing fails, use raw body
        data = response.body;
      }
    }
    
    if (!isSuccess) {
      error = _extractErrorMessage(data) ?? 'Request failed with status ${response.statusCode}';
    }
    
    return NetworkResponse<T>(
      statusCode: response.statusCode,
      data: data as T?,
      error: error,
      message: isSuccess ? 'Success' : error,
      timestamp: DateTime.now(),
      headers: response.headers,
    );
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

