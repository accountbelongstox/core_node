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
import '../interceptors/auth_interceptor.dart';
import '../interceptors/error_interceptor.dart';
import '../interceptors/logging_interceptor.dart';

abstract class BaseServiceInterface {
  Future<ApiResponse<T>> get<T>(String endpoint, {Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> post<T>(String endpoint, {dynamic body, Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> put<T>(String endpoint, {dynamic body, Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> patch<T>(String endpoint, {dynamic body, Map<String, String>? headers, T Function(dynamic)? fromJson});
  Future<ApiResponse<T>> delete<T>(String endpoint, {Map<String, String>? headers, T Function(dynamic)? fromJson});
}

class BaseService implements BaseServiceInterface {
  final String baseUrl;
  final Duration timeout;
  final AuthInterceptor _authInterceptor;
  final ErrorInterceptor _errorInterceptor;
  final LoggingInterceptor _loggingInterceptor;

  BaseService({
    required this.baseUrl,
    this.timeout = const Duration(seconds: 30),
    AuthInterceptor? authInterceptor,
    ErrorInterceptor? errorInterceptor,
    LoggingInterceptor? loggingInterceptor,
  }) : _authInterceptor = authInterceptor ?? AuthInterceptor.instance,
       _errorInterceptor = errorInterceptor ?? ErrorInterceptor.instance,
       _loggingInterceptor = loggingInterceptor ?? LoggingInterceptor.instance;

  @override
  Future<ApiResponse<T>> get<T>(
    String endpoint, {
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    return _makeRequest<T>(
      'GET',
      endpoint,
      headers: headers,
      fromJson: fromJson,
    );
  }

  @override
  Future<ApiResponse<T>> post<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    return _makeRequest<T>(
      'POST',
      endpoint,
      body: body,
      headers: headers,
      fromJson: fromJson,
    );
  }

  @override
  Future<ApiResponse<T>> put<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    return _makeRequest<T>(
      'PUT',
      endpoint,
      body: body,
      headers: headers,
      fromJson: fromJson,
    );
  }

  @override
  Future<ApiResponse<T>> patch<T>(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    return _makeRequest<T>(
      'PATCH',
      endpoint,
      body: body,
      headers: headers,
      fromJson: fromJson,
    );
  }

  @override
  Future<ApiResponse<T>> delete<T>(
    String endpoint, {
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    return _makeRequest<T>(
      'DELETE',
      endpoint,
      headers: headers,
      fromJson: fromJson,
    );
  }

  Future<ApiResponse<T>> _makeRequest<T>(
    String method,
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    T Function(dynamic)? fromJson,
  }) async {
    final url = _buildUrl(endpoint);
    final stopwatch = Stopwatch()..start();
    int attemptCount = 0;

    while (attemptCount < _errorInterceptor.maxRetryAttempts) {
      attemptCount++;

      try {
        // Prepare headers with authentication
        final requestHeaders = await _authInterceptor.processRequest(headers);

        // Log request
        _loggingInterceptor.logRequest(method, url, requestHeaders, body);

        // Make HTTP request (mock implementation)
        final response = await _mockHttpRequest(method, url, requestHeaders, body);

        stopwatch.stop();

        // Log response
        _loggingInterceptor.logResponse(
          method,
          url,
          response.statusCode,
          response.headers,
          response.body,
          stopwatch.elapsed,
        );

        // Process authentication response
        final authSuccess = await _authInterceptor.processResponse(
          response.statusCode,
          response.body != null ? json.decode(response.body!) : null,
        );

        if (!authSuccess && response.statusCode == 401) {
          // Authentication failed, return error
          return ApiResponse<T>.error(
            error: 'Authentication failed',
            statusCode: response.statusCode,
          );
        }

        // Handle successful response
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return _parseSuccessResponse<T>(response, fromJson);
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
            continue; // Retry the request
          }

          _errorInterceptor.onError(networkError);
          return _parseErrorResponse<T>(networkError);
        }
      } catch (e) {
        stopwatch.stop();

        // Log error
        _loggingInterceptor.logError(method, url, e, stopwatch.elapsed);

        // Process error
        final networkError = await _errorInterceptor.processError(e, null, null);

        // Check if should retry
        if (_errorInterceptor.shouldRetry(networkError, attemptCount)) {
          final delay = _errorInterceptor.getRetryDelay(attemptCount);
          if (kDebugMode) {
            print('Retrying request in ${delay.inSeconds} seconds... (Attempt $attemptCount)');
          }
          await Future.delayed(delay);
          continue; // Retry the request
        }

        _errorInterceptor.onError(networkError);
        return _parseErrorResponse<T>(networkError);
      }
    }

    // Max retries exceeded
    return ApiResponse<T>.error(
      error: 'Maximum retry attempts exceeded',
      statusCode: 408, // Request Timeout
    );
  }

  String _buildUrl(String endpoint) {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    
    final cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    
    return '$cleanBaseUrl$cleanEndpoint';
  }

  ApiResponse<T> _parseSuccessResponse<T>(MockHttpResponse response, T Function(dynamic)? fromJson) {
    try {
      if (response.body == null || response.body!.isEmpty) {
        return ApiResponse<T>.success(
          data: null as T,
          statusCode: response.statusCode,
        );
      }

      final jsonData = json.decode(response.body!);
      
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

  // Mock HTTP implementation for demonstration
  Future<MockHttpResponse> _mockHttpRequest(
    String method,
    String url,
    Map<String, String> headers,
    dynamic body,
  ) async {
    // Simulate network delay
    await Future.delayed(Duration(milliseconds: 100 + (DateTime.now().millisecondsSinceEpoch % 500)));

    // Mock different responses based on endpoint
    if (url.contains('/auth/login')) {
      return MockHttpResponse(
        statusCode: 200,
        headers: {'content-type': 'application/json'},
        body: json.encode({
          'success': true,
          'data': {
            'token': 'mock_access_token_${DateTime.now().millisecondsSinceEpoch}',
            'refreshToken': 'mock_refresh_token_${DateTime.now().millisecondsSinceEpoch}',
            'user': {
              'id': 'user_123',
              'username': 'mock_user',
              'email': 'user@example.com',
            }
          }
        }),
      );
    } else if (url.contains('/users')) {
      return MockHttpResponse(
        statusCode: 200,
        headers: {'content-type': 'application/json'},
        body: json.encode({
          'success': true,
          'data': [
            {'id': '1', 'name': 'User 1', 'email': 'user1@example.com'},
            {'id': '2', 'name': 'User 2', 'email': 'user2@example.com'},
          ]
        }),
      );
    } else if (url.contains('/error')) {
      return MockHttpResponse(
        statusCode: 500,
        headers: {'content-type': 'application/json'},
        body: json.encode({
          'success': false,
          'error': 'Internal server error',
          'message': 'Something went wrong on the server'
        }),
      );
    } else {
      // Default success response
      return MockHttpResponse(
        statusCode: 200,
        headers: {'content-type': 'application/json'},
        body: json.encode({
          'success': true,
          'data': {'message': 'Mock response for $method $url'}
        }),
      );
    }
  }
}

// Mock HTTP response for demonstration
class MockHttpResponse {
  final int statusCode;
  final Map<String, String> headers;
  final String? body;

  MockHttpResponse({
    required this.statusCode,
    required this.headers,
    this.body,
  });
}
