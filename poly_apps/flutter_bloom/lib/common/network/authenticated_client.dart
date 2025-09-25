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

import 'dart:convert';
import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'models/api_config.dart';
import '../provider_status/user_provider.dart';
import 'api_client.dart';

/// Authenticated HTTP client that handles authentication automatically
class AuthenticatedClient {
  final ApiConfig config;
  final BuildContext? context;
  final Map<String, String> _cache = {};
  final Map<String, DateTime> _cacheTimestamps = {};

  AuthenticatedClient({
    required this.config,
    this.context,
  });

  /// Get user provider if context is available
  BaseUserProvider? get _userProvider {
    if (context == null) return null;
    try {
      return Provider.of<BaseUserProvider>(context!, listen: false);
    } catch (e) {
      return null;
    }
  }

  /// Check if user is authenticated
  bool get isAuthenticated {
    final userProvider = _userProvider;
    if (userProvider == null) return false;
    
    switch (config.authenticationType) {
      case AuthenticationType.none:
        return true;
      case AuthenticationType.headerKey:
      case AuthenticationType.jwt:
        return userProvider.isAuthenticated && userProvider.token != null;
      case AuthenticationType.oauth:
      case AuthenticationType.apiKey:
        return userProvider.isAuthenticated;
    }
  }

  /// Get authentication headers
  Map<String, String> get _authHeaders {
    final headers = Map<String, String>.from(config.defaultHeaders);
    final userProvider = _userProvider;

    if (userProvider != null && config.authenticationType != AuthenticationType.none) {
      final token = userProvider.token;
      if (token != null && config.headerKey != null) {
        final prefix = config.headerPrefix;
        headers[config.headerKey!] = prefix != null ? '$prefix $token' : token;
      }
    }

    return headers;
  }

  /// Build full URL
  String _buildUrl(String endpoint) {
    final baseUrl = config.baseUrl.endsWith('/') 
        ? config.baseUrl.substring(0, config.baseUrl.length - 1)
        : config.baseUrl;
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    return '$baseUrl$cleanEndpoint';
  }

  /// Check cache for GET requests
  String? _getFromCache(String key) {
    final timestamp = _cacheTimestamps[key];
    if (timestamp == null) return null;
    
    if (DateTime.now().difference(timestamp) > config.cacheTimeout) {
      _cache.remove(key);
      _cacheTimestamps.remove(key);
      return null;
    }
    
    return _cache[key];
  }

  /// Store in cache
  void _storeInCache(String key, String value) {
    _cache[key] = value;
    _cacheTimestamps[key] = DateTime.now();
  }

  /// Make authenticated GET request
  Future<Response> get(String endpoint, {Map<String, String>? queryParams}) async {
    if (!isAuthenticated) {
      return _createUnauthenticatedResponse();
    }

    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);
    final finalUri = queryParams != null 
        ? uri.replace(queryParameters: queryParams)
        : uri;

    // Check cache for GET requests
    final cacheKey = finalUri.toString();
    final cachedResponse = _getFromCache(cacheKey);
    if (cachedResponse != null) {
      final cachedData = json.decode(cachedResponse);
      return Response(
        body: cachedData,
        bodyString: cachedResponse,
        statusCode: 200,
        headers: {'x-cache': 'HIT'},
        url: finalUri,
        method: 'GET',
      );
    }

    try {
      final response = await http.get(
        finalUri,
        headers: _authHeaders,
      ).timeout(Duration(seconds: config.timeoutSeconds));

      final result = _processResponse(response, 'GET', finalUri);
      
      // Cache successful GET responses
      if (result.statusCode == 200 && result.bodyString != null) {
        _storeInCache(cacheKey, result.bodyString!);
      }

      return result;
    } catch (e) {
      if (config.enableLogging) {
        log('GET request failed: $e', name: 'AuthenticatedClient');
      }
      return _createErrorResponse(e.toString());
    }
  }

  /// Make authenticated POST request
  Future<Response> post(String endpoint, Map<String, dynamic> data) async {
    if (!isAuthenticated) {
      return _createUnauthenticatedResponse();
    }

    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final headers = Map<String, String>.from(_authHeaders);
      headers['Content-Type'] = 'application/json';

      final response = await http.post(
        uri,
        headers: headers,
        body: json.encode(data),
      ).timeout(Duration(seconds: config.timeoutSeconds));

      return _processResponse(response, 'POST', uri);
    } catch (e) {
      if (config.enableLogging) {
        log('POST request failed: $e', name: 'AuthenticatedClient');
      }
      return _createErrorResponse(e.toString());
    }
  }

  /// Make authenticated PUT request
  Future<Response> put(String endpoint, Map<String, dynamic> data) async {
    if (!isAuthenticated) {
      return _createUnauthenticatedResponse();
    }

    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final headers = Map<String, String>.from(_authHeaders);
      headers['Content-Type'] = 'application/json';

      final response = await http.put(
        uri,
        headers: headers,
        body: json.encode(data),
      ).timeout(Duration(seconds: config.timeoutSeconds));

      return _processResponse(response, 'PUT', uri);
    } catch (e) {
      if (config.enableLogging) {
        log('PUT request failed: $e', name: 'AuthenticatedClient');
      }
      return _createErrorResponse(e.toString());
    }
  }

  /// Make authenticated DELETE request
  Future<Response> delete(String endpoint) async {
    if (!isAuthenticated) {
      return _createUnauthenticatedResponse();
    }

    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final response = await http.delete(
        uri,
        headers: _authHeaders,
      ).timeout(Duration(seconds: config.timeoutSeconds));

      return _processResponse(response, 'DELETE', uri);
    } catch (e) {
      if (config.enableLogging) {
        log('DELETE request failed: $e', name: 'AuthenticatedClient');
      }
      return _createErrorResponse(e.toString());
    }
  }

  /// Process HTTP response
  Response _processResponse(http.Response response, String method, Uri uri) {
    dynamic body;
    try {
      body = json.decode(response.body);
    } catch (e) {
      body = response.body;
    }

    final result = Response(
      body: body,
      bodyString: response.body,
      statusCode: response.statusCode,
      headers: response.headers,
      url: uri,
      method: method,
    );

    // Check if authentication failed
    if (config.responseValidation.isAuthFailure(response.statusCode, body is Map<String, dynamic> ? body : null)) {
      _handleAuthFailure();
    }

    if (config.enableLogging) {
      log('$method ${uri.toString()} -> ${response.statusCode}', name: 'AuthenticatedClient');
    }

    return result;
  }

  /// Create unauthenticated response
  Response _createUnauthenticatedResponse() {
    return Response(
      body: {'error': 'User not authenticated', 'code': 'UNAUTHENTICATED'},
      bodyString: '{"error": "User not authenticated", "code": "UNAUTHENTICATED"}',
      statusCode: 401,
      headers: {'x-auth-status': 'UNAUTHENTICATED'},
      method: 'ERROR',
    );
  }

  /// Create error response
  Response _createErrorResponse(String error) {
    return Response(
      body: {'error': error, 'code': 'NETWORK_ERROR'},
      bodyString: '{"error": "$error", "code": "NETWORK_ERROR"}',
      statusCode: 500,
      headers: {'x-error': 'NETWORK_ERROR'},
      method: 'ERROR',
    );
  }

  /// Handle authentication failure
  void _handleAuthFailure() {
    final userProvider = _userProvider;
    if (userProvider != null) {
      userProvider.clearUser();
    }
    
    if (config.enableLogging) {
      log('Authentication failed, clearing user session', name: 'AuthenticatedClient');
    }
  }

  /// Clear cache
  void clearCache() {
    _cache.clear();
    _cacheTimestamps.clear();
  }

  /// Get cache statistics
  Map<String, dynamic> getCacheStats() {
    return {
      'size': _cache.length,
      'keys': _cache.keys.toList(),
      'oldest': _cacheTimestamps.values.isEmpty 
          ? null 
          : _cacheTimestamps.values.reduce((a, b) => a.isBefore(b) ? a : b),
      'newest': _cacheTimestamps.values.isEmpty 
          ? null 
          : _cacheTimestamps.values.reduce((a, b) => a.isAfter(b) ? a : b),
    };
  }
}
