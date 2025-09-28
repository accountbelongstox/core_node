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
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/api_response.dart';
import '../models/api_config.dart';
import '../interceptors/auth_interceptor.dart';
import '../interceptors/error_interceptor.dart';
import '../interceptors/logging_interceptor.dart';
import '../utils/network_utils.dart';

class EnhancedHttpClient {
  final ApiConfig config;
  final http.Client _httpClient;
  final AuthInterceptor _authInterceptor;
  final ErrorInterceptor _errorInterceptor;
  final LoggingInterceptor _loggingInterceptor;
  final NetworkUtils _networkUtils;
  
  static final Map<String, EnhancedHttpClient> _instances = {};
  
  EnhancedHttpClient._({
    required this.config,
    http.Client? httpClient,
    AuthInterceptor? authInterceptor,
    ErrorInterceptor? errorInterceptor,
    LoggingInterceptor? loggingInterceptor,
    NetworkUtils? networkUtils,
  }) : _httpClient = httpClient ?? http.Client(),
       _authInterceptor = authInterceptor ?? AuthInterceptor.instance,
       _errorInterceptor = errorInterceptor ?? ErrorInterceptor.instance,
       _loggingInterceptor = loggingInterceptor ?? LoggingInterceptor.instance,
       _networkUtils = networkUtils ?? NetworkUtils.instance;

  factory EnhancedHttpClient.create({
    required ApiConfig config,
    String? instanceKey,
    http.Client? httpClient,
    AuthInterceptor? authInterceptor,
    ErrorInterceptor? errorInterceptor,
    LoggingInterceptor? loggingInterceptor,
    NetworkUtils? networkUtils,
  }) {
    final key = instanceKey ?? config.baseUrl;
    
    if (_instances.containsKey(key)) {
      return _instances[key]!;
    }
    
    final client = EnhancedHttpClient._(
      config: config,
      httpClient: httpClient,
      authInterceptor: authInterceptor,
      errorInterceptor: errorInterceptor,
      loggingInterceptor: loggingInterceptor,
      networkUtils: networkUtils,
    );
    
    _instances[key] = client;
    return client;
  }

  Future<ApiResponse<T>> get<T>(
    String endpoint, {
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    Duration? timeout,
    bool useCache = false,
    String? cacheKey,
  }) async {
    return _makeRequest<T>(
      'GET',
      endpoint,
      headers: headers,
      queryParameters: queryParameters,
      fromJson: fromJson,
      timeout: timeout,
      useCache: useCache,
      cacheKey: cacheKey,
    );
  }

  Future<ApiResponse<T>> post<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    Duration? timeout,
    bool validateResponse = true,
  }) async {
    return _makeRequest<T>(
      'POST',
      endpoint,
      body: body,
      headers: headers,
      queryParameters: queryParameters,
      fromJson: fromJson,
      timeout: timeout,
      validateResponse: validateResponse,
    );
  }

  Future<ApiResponse<T>> put<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    Duration? timeout,
  }) async {
    return _makeRequest<T>(
      'PUT',
      endpoint,
      body: body,
      headers: headers,
      queryParameters: queryParameters,
      fromJson: fromJson,
      timeout: timeout,
    );
  }

  Future<ApiResponse<T>> patch<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    Duration? timeout,
  }) async {
    return _makeRequest<T>(
      'PATCH',
      endpoint,
      body: body,
      headers: headers,
      queryParameters: queryParameters,
      fromJson: fromJson,
      timeout: timeout,
    );
  }

  Future<ApiResponse<T>> delete<T>(
    String endpoint, {
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    Duration? timeout,
  }) async {
    return _makeRequest<T>(
      'DELETE',
      endpoint,
      headers: headers,
      queryParameters: queryParameters,
      fromJson: fromJson,
      timeout: timeout,
    );
  }

  Future<ApiResponse<T>> upload<T>(
    String endpoint,
    List<http.MultipartFile> files, {
    Map<String, String>? fields,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
    Duration? timeout,
    void Function(int sent, int total)? onProgress,
  }) async {
    if (!await _networkUtils.isConnected()) {
      return ApiResponse<T>.error(
        error: 'No internet connection',
        statusCode: 0,
      );
    }

    final url = _buildUrl(endpoint);
    final stopwatch = Stopwatch()..start();
    
    try {
      final request = http.MultipartRequest('POST', Uri.parse(url));
      
      // Add headers
      final requestHeaders = await _authInterceptor.processRequest(headers);
      request.headers.addAll(requestHeaders);
      
      // Add fields
      if (fields != null) {
        request.fields.addAll(fields);
      }
      
      // Add files
      request.files.addAll(files);
      
      if (config.enableLogging) {
        _loggingInterceptor.logRequest('POST', url, requestHeaders, 'Multipart upload');
      }
      
      final streamedResponse = await request.send().timeout(
        timeout ?? Duration(seconds: config.timeoutSeconds),
      );
      
      final response = await http.Response.fromStream(streamedResponse);
      stopwatch.stop();
      
      if (config.enableLogging) {
        _loggingInterceptor.logResponse(
          'POST',
          url,
          response.statusCode,
          response.headers,
          response.body,
          stopwatch.elapsed,
        );
      }
      
      return _parseResponse<T>(response, fromJson);
      
    } catch (e) {
      stopwatch.stop();
      
      if (config.enableLogging) {
        _loggingInterceptor.logError('POST', url, e, stopwatch.elapsed);
      }
      
      return ApiResponse<T>.error(
        error: 'Upload failed: $e',
        statusCode: 0,
      );
    }
  }

  Future<ApiResponse<T>> _makeRequest<T>(
    String method,
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
    Duration? timeout,
    bool useCache = false,
    String? cacheKey,
    bool validateResponse = true,
  }) async {
    // Check network connectivity
    if (!await _networkUtils.isConnected()) {
      return ApiResponse<T>.error(
        error: 'No internet connection',
        statusCode: 0,
      );
    }

    final url = _buildUrl(endpoint, queryParameters);
    final stopwatch = Stopwatch()..start();
    int attemptCount = 0;

    while (attemptCount < _errorInterceptor.maxRetryAttempts) {
      attemptCount++;

      try {
        // Prepare headers with authentication
        final requestHeaders = await _authInterceptor.processRequest(headers);
        requestHeaders.addAll(config.defaultHeaders);

        // Log request
        if (config.enableLogging) {
          _loggingInterceptor.logRequest(method, url, requestHeaders, body);
        }

        // Make HTTP request
        final response = await _performHttpRequest(
          method,
          url,
          requestHeaders,
          body,
          timeout ?? Duration(seconds: config.timeoutSeconds),
        );

        stopwatch.stop();

        // Log response
        if (config.enableLogging) {
          _loggingInterceptor.logResponse(
            method,
            url,
            response.statusCode,
            response.headers,
            response.body,
            stopwatch.elapsed,
          );
        }

        // Process authentication response
        final authSuccess = await _authInterceptor.processResponse(
          response.statusCode,
          response.body.isNotEmpty ? json.decode(response.body) : null,
        );

        if (!authSuccess && config.responseValidation.isAuthFailure(response.statusCode, null)) {
          return ApiResponse<T>.error(
            error: 'Authentication failed',
            statusCode: response.statusCode,
          );
        }

        // Validate response
        final responseBody = response.body.isNotEmpty ? json.decode(response.body) : null;
        final isSuccess = validateResponse
            ? config.responseValidation.isSuccess(response.statusCode, responseBody)
            : response.statusCode >= 200 && response.statusCode < 300;

        if (isSuccess) {
          return _parseResponse<T>(response, fromJson);
        } else {
          // Handle error response
          final networkError = await _errorInterceptor.processError(
            null,
            response.statusCode,
            response.body,
          );

          // Check if should retry
          if (_errorInterceptor.shouldRetry(networkError, attemptCount)) {
            final delay = _errorInterceptor.getRetryDelay(attemptCount);
            if (kDebugMode) {
              print('Retrying request in ${delay.inSeconds} seconds... (Attempt $attemptCount)');
            }
            await Future.delayed(delay);
            continue;
          }

          _errorInterceptor.onError(networkError);
          return _parseErrorResponse<T>(networkError);
        }
      } catch (e) {
        stopwatch.stop();

        if (config.enableLogging) {
          _loggingInterceptor.logError(method, url, e, stopwatch.elapsed);
        }

        final networkError = await _errorInterceptor.processError(e, null, null);

        if (_errorInterceptor.shouldRetry(networkError, attemptCount)) {
          final delay = _errorInterceptor.getRetryDelay(attemptCount);
          if (kDebugMode) {
            print('Retrying request in ${delay.inSeconds} seconds... (Attempt $attemptCount)');
          }
          await Future.delayed(delay);
          continue;
        }

        _errorInterceptor.onError(networkError);
        return _parseErrorResponse<T>(networkError);
      }
    }

    return ApiResponse<T>.error(
      error: 'Maximum retry attempts exceeded',
      statusCode: 408,
    );
  }

  Future<http.Response> _performHttpRequest(
    String method,
    String url,
    Map<String, String> headers,
    dynamic body,
    Duration timeout,
  ) async {
    final uri = Uri.parse(url);

    switch (method.toUpperCase()) {
      case 'GET':
        return await _httpClient.get(uri, headers: headers).timeout(timeout);
      case 'POST':
        return await _httpClient.post(
          uri,
          headers: headers,
          body: body != null ? json.encode(body) : null,
        ).timeout(timeout);
      case 'PUT':
        return await _httpClient.put(
          uri,
          headers: headers,
          body: body != null ? json.encode(body) : null,
        ).timeout(timeout);
      case 'PATCH':
        return await _httpClient.patch(
          uri,
          headers: headers,
          body: body != null ? json.encode(body) : null,
        ).timeout(timeout);
      case 'DELETE':
        return await _httpClient.delete(uri, headers: headers).timeout(timeout);
      default:
        throw UnsupportedError('HTTP method $method is not supported');
    }
  }

  String _buildUrl(String endpoint, [Map<String, dynamic>? queryParameters]) {
    String url;

    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      url = endpoint;
    } else {
      final cleanBaseUrl = config.baseUrl.endsWith('/')
          ? config.baseUrl.substring(0, config.baseUrl.length - 1)
          : config.baseUrl;
      final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
      url = '$cleanBaseUrl$cleanEndpoint';
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

  ApiResponse<T> _parseResponse<T>(http.Response response, T Function(dynamic)? fromJson) {
    try {
      if (response.body.isEmpty) {
        return ApiResponse<T>.success(
          data: null as T,
          statusCode: response.statusCode,
        );
      }

      final jsonData = json.decode(response.body);

      T? data;
      if (fromJson != null && jsonData != null) {
        data = fromJson(jsonData);
      } else {
        data = jsonData as T?;
      }

      return ApiResponse<T>.success(
        data: data as T,
        statusCode: response.statusCode,
      );
    } catch (e) {
      return ApiResponse<T>.error(
        error: 'Failed to parse response: $e',
        statusCode: response.statusCode,
      );
    }
  }

  ApiResponse<T> _parseErrorResponse<T>(NetworkError networkError) {
    return ApiResponse<T>.error(
      error: networkError.message,
      message: networkError.details,
      statusCode: networkError.statusCode,
      metadata: {
        'errorType': networkError.type.name,
        'timestamp': networkError.timestamp.toIso8601String(),
      },
    );
  }

  void dispose() {
    _httpClient.close();
  }

  static void disposeAll() {
    for (final client in _instances.values) {
      client.dispose();
    }
    _instances.clear();
  }
}
