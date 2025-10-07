import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../core/network_types.dart';
import '../models/api_response.dart';
import '../auth/unified_auth_manager.dart';
import '../interceptors/network_interceptors.dart';

/// Legacy network client for backward compatibility
class NetworkClient {
  static NetworkClient? _instance;
  static NetworkClient get instance => _instance ??= NetworkClient._();
  NetworkClient._();

  final http.Client _httpClient = http.Client();
  final UnifiedAuthManager _authManager = UnifiedAuthManager.instance;
  final List<NetworkInterceptor> _interceptors = [];

  String? _baseUrl;
  Duration _connectTimeout = const Duration(seconds: 30);
  Duration _receiveTimeout = const Duration(seconds: 30);
  Map<String, String> _defaultHeaders = {};

  /// Initialize network client
  Future<void> initialize({
    String? baseUrl,
    Duration? connectTimeout,
    Duration? receiveTimeout,
    Map<String, String>? defaultHeaders,
  }) async {
    _baseUrl = baseUrl;
    _connectTimeout = connectTimeout ?? _connectTimeout;
    _receiveTimeout = receiveTimeout ?? _receiveTimeout;
    _defaultHeaders = defaultHeaders ?? {};

    // Add default interceptors
    _interceptors.addAll([
      LoggingInterceptor(),
      AuthInterceptor(_authManager),
      ErrorInterceptor(),
    ]);
  }

  /// Add interceptor
  void addInterceptor(NetworkInterceptor interceptor) {
    _interceptors.add(interceptor);
  }

  /// Remove interceptor
  void removeInterceptor(NetworkInterceptor interceptor) {
    _interceptors.remove(interceptor);
  }

  /// Make GET request
  Future<ApiResponse<T>> get<T>(
    String endpoint, {
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _makeRequest<T>(
      'GET',
      endpoint,
      headers: headers,
      queryParameters: queryParameters,
    );
  }

  /// Make POST request
  Future<ApiResponse<T>> post<T>(
    String endpoint, {
    dynamic data,
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _makeRequest<T>(
      'POST',
      endpoint,
      data: data,
      headers: headers,
      queryParameters: queryParameters,
    );
  }

  /// Make PUT request
  Future<ApiResponse<T>> put<T>(
    String endpoint, {
    dynamic data,
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _makeRequest<T>(
      'PUT',
      endpoint,
      data: data,
      headers: headers,
      queryParameters: queryParameters,
    );
  }

  /// Make DELETE request
  Future<ApiResponse<T>> delete<T>(
    String endpoint, {
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _makeRequest<T>(
      'DELETE',
      endpoint,
      headers: headers,
      queryParameters: queryParameters,
    );
  }

  Future<ApiResponse<T>> _makeRequest<T>(
    String method,
    String endpoint, {
    dynamic data,
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      // Build URL
      final url = _buildUrl(endpoint, queryParameters);
      
      // Prepare headers
      final requestHeaders = <String, String>{
        ..._defaultHeaders,
        'Content-Type': 'application/json',
        ...?headers,
      };

      // Add auth headers if available
      if (_authManager.isAuthenticated) {
        requestHeaders.addAll(_authManager.getAuthHeaders());
      }

      // Create request
      final request = NetworkRequest(
        method: method,
        url: url,
        headers: requestHeaders,
        data: data,
        timestamp: DateTime.now(),
      );

      // Apply request interceptors
      NetworkRequest processedRequest = request;
      for (final interceptor in _interceptors) {
        processedRequest = await interceptor.onRequest(processedRequest);
      }

      // Make HTTP request
      final response = await _executeRequest(processedRequest);

      // Apply response interceptors
      NetworkResponse processedResponse = response;
      for (final interceptor in _interceptors) {
        processedResponse = await interceptor.onResponse(processedResponse);
      }

      // Convert to ApiResponse
      return _convertToApiResponse<T>(processedResponse);

    } catch (error) {
      // Apply error interceptors
      for (final interceptor in _interceptors) {
        await interceptor.onError(error);
      }

      return ApiResponse<T>(
        success: false,
        error: error.toString(),
        statusCode: error is http.ClientException ? 0 : null,
      );
    }
  }

  Future<NetworkResponse> _executeRequest(NetworkRequest request) async {
    final uri = Uri.parse(request.url);
    http.Response response;

    switch (request.method.toUpperCase()) {
      case 'GET':
        response = await _httpClient.get(uri, headers: request.headers);
        break;
      case 'POST':
        response = await _httpClient.post(
          uri,
          headers: request.headers,
          body: request.data != null ? jsonEncode(request.data) : null,
        );
        break;
      case 'PUT':
        response = await _httpClient.put(
          uri,
          headers: request.headers,
          body: request.data != null ? jsonEncode(request.data) : null,
        );
        break;
      case 'DELETE':
        response = await _httpClient.delete(uri, headers: request.headers);
        break;
      default:
        throw UnsupportedError('HTTP method ${request.method} not supported');
    }

    return NetworkResponse(
      statusCode: response.statusCode,
      data: response.body,
      headers: response.headers,
      timestamp: DateTime.now(),
    );
  }

  ApiResponse<T> _convertToApiResponse<T>(NetworkResponse response) {
    final isSuccess = response.statusCode >= 200 && response.statusCode < 300;
    
    dynamic data;
    try {
      data = response.data.isNotEmpty ? jsonDecode(response.data) : null;
    } catch (e) {
      data = response.data;
    }

    return ApiResponse<T>(
      success: isSuccess,
      data: data as T?,
      statusCode: response.statusCode,
      error: isSuccess ? null : 'HTTP ${response.statusCode}',
    );
  }

  String _buildUrl(String endpoint, Map<String, dynamic>? queryParameters) {
    String url = endpoint;
    
    if (_baseUrl != null && !endpoint.startsWith('http')) {
      url = '${_baseUrl!.replaceAll(RegExp(r'/$'), '')}/${endpoint.replaceAll(RegExp(r'^/'), '')}';
    }

    if (queryParameters != null && queryParameters.isNotEmpty) {
      final uri = Uri.parse(url);
      final newUri = uri.replace(
        queryParameters: {
          ...uri.queryParameters,
          ...queryParameters.map((key, value) => MapEntry(key, value.toString())),
        },
      );
      url = newUri.toString();
    }

    return url;
  }

  /// Dispose resources
  void dispose() {
    _httpClient.close();
  }
}
