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
import 'package:flutter/foundation.dart';
import '../models/api_response.dart';
import '../models/api_config.dart';
import '../client/enhanced_http_client.dart';
import '../security/device_security_manager.dart';
import '../../cache_manager/cache_manager.dart';

abstract class EnhancedBaseServiceInterface {
  Future<ApiResponse<T>> get<T>(String endpoint, {Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> post<T>(String endpoint, {dynamic body, Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> put<T>(String endpoint, {dynamic body, Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> patch<T>(String endpoint, {dynamic body, Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> delete<T>(String endpoint, {Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<bool> isAuthenticated();
  Future<void> logout();
}

class EnhancedBaseService implements EnhancedBaseServiceInterface {
  final ApiConfig config;
  final EnhancedHttpClient _httpClient;
  final DeviceSecurityManager _securityManager;
  final CacheManager _cacheManager;
  
  String? _authToken;
  String? _refreshToken;
  DateTime? _tokenExpiry;
  bool _isRefreshing = false;
  final List<Completer<String?>> _refreshCompleters = [];

  EnhancedBaseService({
    required this.config,
    EnhancedHttpClient? httpClient,
    DeviceSecurityManager? securityManager,
    CacheManager? cacheManager,
  }) : _httpClient = httpClient ?? EnhancedHttpClient.create(config: config),
       _securityManager = securityManager ?? DeviceSecurityManager.instance,
       _cacheManager = cacheManager ?? CacheManager.instance;

  @override
  Future<ApiResponse<T>> get<T>(
    String endpoint, {
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    bool useCache = false,
    Duration? cacheDuration,
  }) async {
    if (_securityManager.isDeviceLocked) {
      return ApiResponse<T>.error(
        error: 'Device is locked for security reasons',
        statusCode: 423,
      );
    }

    final enhancedHeaders = await _buildHeaders(headers);
    
    if (useCache) {
      final cacheKey = _buildCacheKey('GET', endpoint, queryParameters);
      final cachedResponse = await _getCachedResponse<T>(cacheKey, fromJson);
      if (cachedResponse != null) {
        return cachedResponse;
      }
    }

    final response = await _httpClient.get<T>(
      endpoint,
      headers: enhancedHeaders,
      queryParameters: queryParameters,
      fromJson: fromJson,
    );

    await _handleSecurityResponse(response);
    
    if (useCache && response.success) {
      final cacheKey = _buildCacheKey('GET', endpoint, queryParameters);
      await _cacheResponse(cacheKey, response, cacheDuration);
    }

    return response;
  }

  @override
  Future<ApiResponse<T>> post<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
    bool requiresAuth = true,
  }) async {
    if (_securityManager.isDeviceLocked) {
      return ApiResponse<T>.error(
        error: 'Device is locked for security reasons',
        statusCode: 423,
      );
    }

    if (requiresAuth && !await isAuthenticated()) {
      final refreshResult = await _refreshTokenIfNeeded();
      if (!refreshResult) {
        return ApiResponse<T>.error(
          error: 'Authentication required',
          statusCode: 401,
        );
      }
    }

    final enhancedHeaders = await _buildHeaders(headers);
    final enhancedBody = await _enhanceRequestBody(body);

    final response = await _httpClient.post<T>(
      endpoint,
      body: enhancedBody,
      headers: enhancedHeaders,
      fromJson: fromJson,
    );

    await _handleSecurityResponse(response);
    return response;
  }

  @override
  Future<ApiResponse<T>> put<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    if (_securityManager.isDeviceLocked) {
      return ApiResponse<T>.error(
        error: 'Device is locked for security reasons',
        statusCode: 423,
      );
    }

    final enhancedHeaders = await _buildHeaders(headers);
    final enhancedBody = await _enhanceRequestBody(body);

    final response = await _httpClient.put<T>(
      endpoint,
      body: enhancedBody,
      headers: enhancedHeaders,
      fromJson: fromJson,
    );

    await _handleSecurityResponse(response);
    return response;
  }

  @override
  Future<ApiResponse<T>> patch<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    if (_securityManager.isDeviceLocked) {
      return ApiResponse<T>.error(
        error: 'Device is locked for security reasons',
        statusCode: 423,
      );
    }

    final enhancedHeaders = await _buildHeaders(headers);
    final enhancedBody = await _enhanceRequestBody(body);

    final response = await _httpClient.patch<T>(
      endpoint,
      body: enhancedBody,
      headers: enhancedHeaders,
      fromJson: fromJson,
    );

    await _handleSecurityResponse(response);
    return response;
  }

  @override
  Future<ApiResponse<T>> delete<T>(
    String endpoint, {
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    if (_securityManager.isDeviceLocked) {
      return ApiResponse<T>.error(
        error: 'Device is locked for security reasons',
        statusCode: 423,
      );
    }

    final enhancedHeaders = await _buildHeaders(headers);

    final response = await _httpClient.delete<T>(
      endpoint,
      headers: enhancedHeaders,
      fromJson: fromJson,
    );

    await _handleSecurityResponse(response);
    return response;
  }

  Future<ApiResponse<T>> login<T>(
    String endpoint,
    Map<String, dynamic> credentials, {
    T Function(dynamic)? fromJson,
  }) async {
    final enhancedCredentials = await _enhanceRequestBody(credentials);
    
    final response = await _httpClient.post<T>(
      endpoint,
      body: enhancedCredentials,
      headers: await _buildHeaders(),
      fromJson: fromJson,
    );

    if (response.success && response.data != null) {
      await _extractAndStoreTokens(response.data);
    }

    await _handleSecurityResponse(response);
    return response;
  }

  @override
  Future<bool> isAuthenticated() async {
    if (_authToken == null) return false;
    if (_tokenExpiry == null) return true;
    
    final now = DateTime.now();
    final buffer = const Duration(minutes: 5);
    
    return now.isBefore(_tokenExpiry!.subtract(buffer));
  }

  @override
  Future<void> logout() async {
    _authToken = null;
    _refreshToken = null;
    _tokenExpiry = null;
    
    // Clear cached data
    await _cacheManager.clearAll();
    
    // Clear security data if needed
    // await _securityManager.clearSecurityData();
  }

  Future<Map<String, String>> _buildHeaders([Map<String, String>? additionalHeaders]) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add security headers
    final securityHeaders = await _securityManager.getSecurityHeaders();
    headers.addAll(securityHeaders);

    // Add authentication header
    if (_authToken != null && config.authenticationType != AuthenticationType.none) {
      final headerKey = config.headerKey ?? 'Authorization';
      final headerPrefix = config.headerPrefix ?? 'Bearer';
      headers[headerKey] = '$headerPrefix $_authToken';
    }

    // Add additional headers
    if (additionalHeaders != null) {
      headers.addAll(additionalHeaders);
    }

    return headers;
  }

  Future<dynamic> _enhanceRequestBody(dynamic body) async {
    if (body == null) return null;
    
    if (body is Map<String, dynamic>) {
      final enhancedBody = Map<String, dynamic>.from(body);
      
      // Add device information
      enhancedBody['device_id'] = await _securityManager.getDeviceId();
      enhancedBody['app_signature'] = await _securityManager.getAppSignature();
      enhancedBody['timestamp'] = DateTime.now().millisecondsSinceEpoch;
      
      return enhancedBody;
    }
    
    return body;
  }

  Future<void> _handleSecurityResponse<T>(ApiResponse<T> response) async {
    if (response.success && response.data != null) {
      // Check if response contains security instructions
      if (response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        await _securityManager.validateServerResponse(data);
      }
    }
  }

  Future<void> _extractAndStoreTokens(dynamic responseData) async {
    if (responseData is Map<String, dynamic>) {
      _authToken = responseData['token'] ?? responseData['access_token'];
      _refreshToken = responseData['refresh_token'];
      
      if (responseData.containsKey('expires_in')) {
        final expiresIn = responseData['expires_in'] as int;
        _tokenExpiry = DateTime.now().add(Duration(seconds: expiresIn));
      } else if (responseData.containsKey('expires_at')) {
        _tokenExpiry = DateTime.parse(responseData['expires_at']);
      }
    }
  }

  Future<bool> _refreshTokenIfNeeded() async {
    if (_isRefreshing) {
      final completer = Completer<String?>();
      _refreshCompleters.add(completer);
      final result = await completer.future;
      return result != null;
    }

    if (_refreshToken == null) return false;

    _isRefreshing = true;

    try {
      final response = await _httpClient.post(
        '/auth/refresh',
        body: {'refresh_token': _refreshToken},
        headers: await _buildHeaders(),
      );

      if (response.success && response.data != null) {
        await _extractAndStoreTokens(response.data);
        
        // Complete all waiting requests
        for (final completer in _refreshCompleters) {
          completer.complete(_authToken);
        }
        _refreshCompleters.clear();
        
        return true;
      }
    } catch (e) {
      if (kDebugMode) {
        print('Token refresh failed: $e');
      }
    } finally {
      _isRefreshing = false;
      
      // Complete any remaining requests with null
      for (final completer in _refreshCompleters) {
        completer.complete(null);
      }
      _refreshCompleters.clear();
    }

    return false;
  }

  String _buildCacheKey(String method, String endpoint, [Map<String, dynamic>? params]) {
    final paramsString = params != null ? json.encode(params) : '';
    return '$method:$endpoint:$paramsString';
  }

  Future<ApiResponse<T>?> _getCachedResponse<T>(String cacheKey, T Function(dynamic)? fromJson) async {
    final cachedData = await _cacheManager.get(cacheKey);
    if (cachedData != null) {
      try {
        return ApiResponse<T>.fromJson(cachedData, fromJson);
      } catch (e) {
        if (kDebugMode) {
          print('Failed to parse cached response: $e');
        }
      }
    }
    return null;
  }

  Future<void> _cacheResponse<T>(String cacheKey, ApiResponse<T> response, Duration? duration) async {
    try {
      await _cacheManager.set(
        cacheKey,
        response.toJson(),
        expiry: duration ?? config.cacheTimeout,
      );
    } catch (e) {
      if (kDebugMode) {
        print('Failed to cache response: $e');
      }
    }
  }
}
