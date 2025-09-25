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
import 'package:http/http.dart' as http;
import 'models/api_config.dart';
import 'api_client.dart';

/// Public HTTP client for non-authenticated requests
/// Used for public resources like logos, public content, etc.
class PublicClient {
  final ApiConfig config;
  final Map<String, String> _cache = {};
  final Map<String, DateTime> _cacheTimestamps = {};

  PublicClient({required this.config});

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

  /// Make public GET request
  Future<Response> get(String endpoint, {Map<String, String>? queryParams}) async {
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
        headers: config.defaultHeaders,
      ).timeout(Duration(seconds: config.timeoutSeconds));

      final result = _processResponse(response, 'GET', finalUri);
      
      // Cache successful GET responses
      if (result.statusCode == 200 && result.bodyString != null) {
        _storeInCache(cacheKey, result.bodyString!);
      }

      return result;
    } catch (e) {
      if (config.enableLogging) {
        log('Public GET request failed: $e', name: 'PublicClient');
      }
      return _createErrorResponse(e.toString());
    }
  }

  /// Make public POST request
  Future<Response> post(String endpoint, Map<String, dynamic> data) async {
    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final headers = Map<String, String>.from(config.defaultHeaders);
      headers['Content-Type'] = 'application/json';

      final response = await http.post(
        uri,
        headers: headers,
        body: json.encode(data),
      ).timeout(Duration(seconds: config.timeoutSeconds));

      return _processResponse(response, 'POST', uri);
    } catch (e) {
      if (config.enableLogging) {
        log('Public POST request failed: $e', name: 'PublicClient');
      }
      return _createErrorResponse(e.toString());
    }
  }

  /// Make public PUT request
  Future<Response> put(String endpoint, Map<String, dynamic> data) async {
    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final headers = Map<String, String>.from(config.defaultHeaders);
      headers['Content-Type'] = 'application/json';

      final response = await http.put(
        uri,
        headers: headers,
        body: json.encode(data),
      ).timeout(Duration(seconds: config.timeoutSeconds));

      return _processResponse(response, 'PUT', uri);
    } catch (e) {
      if (config.enableLogging) {
        log('Public PUT request failed: $e', name: 'PublicClient');
      }
      return _createErrorResponse(e.toString());
    }
  }

  /// Make public DELETE request
  Future<Response> delete(String endpoint) async {
    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final response = await http.delete(
        uri,
        headers: config.defaultHeaders,
      ).timeout(Duration(seconds: config.timeoutSeconds));

      return _processResponse(response, 'DELETE', uri);
    } catch (e) {
      if (config.enableLogging) {
        log('Public DELETE request failed: $e', name: 'PublicClient');
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

    if (config.enableLogging) {
      log('$method ${uri.toString()} -> ${response.statusCode}', name: 'PublicClient');
    }

    return result;
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

  /// Download file from public endpoint
  Future<List<int>?> downloadFile(String endpoint) async {
    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final response = await http.get(
        uri,
        headers: config.defaultHeaders,
      ).timeout(Duration(seconds: config.timeoutSeconds * 2)); // Longer timeout for files

      if (response.statusCode == 200) {
        return response.bodyBytes;
      } else {
        if (config.enableLogging) {
          log('File download failed: ${response.statusCode}', name: 'PublicClient');
        }
        return null;
      }
    } catch (e) {
      if (config.enableLogging) {
        log('File download failed: $e', name: 'PublicClient');
      }
      return null;
    }
  }

  /// Check if resource exists
  Future<bool> exists(String endpoint) async {
    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final response = await http.head(
        uri,
        headers: config.defaultHeaders,
      ).timeout(Duration(seconds: config.timeoutSeconds));

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  /// Get resource metadata
  Future<Map<String, String>?> getMetadata(String endpoint) async {
    final url = _buildUrl(endpoint);
    final uri = Uri.parse(url);

    try {
      final response = await http.head(
        uri,
        headers: config.defaultHeaders,
      ).timeout(Duration(seconds: config.timeoutSeconds));

      if (response.statusCode == 200) {
        return response.headers;
      }
      return null;
    } catch (e) {
      return null;
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
