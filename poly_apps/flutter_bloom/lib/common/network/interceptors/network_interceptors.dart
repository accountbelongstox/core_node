import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../core/network_config.dart';
// REFACTOR: Renamed network_models.dart to endpoint_network_models.dart  
import '../core/endpoint_network_models.dart';
import '../auth/unified_auth_manager.dart';

/// Network interceptors for request/response processing
class NetworkInterceptors {
  static NetworkInterceptors? _instance;
  static NetworkInterceptors get instance => _instance ??= NetworkInterceptors._();
  NetworkInterceptors._();

  final List<RequestInterceptor> _requestInterceptors = [];
  final List<ResponseInterceptor> _responseInterceptors = [];
  bool _isInitialized = false;

  /// Initialize interceptors
  Future<void> initialize() async {
    if (_isInitialized) {
      return;
    }
    // Add default interceptors
    _requestInterceptors.addAll([
      LoggingRequestInterceptor(),
      AuthRequestInterceptor(),
      SecurityRequestInterceptor(),
    ]);

    _responseInterceptors.addAll([
      LoggingResponseInterceptor(),
      AuthResponseInterceptor(),
      ErrorResponseInterceptor(),
    ]);

    debugPrint('NetworkInterceptors initialized with ${_requestInterceptors.length} request and ${_responseInterceptors.length} response interceptors');
    _isInitialized = true;
  }

  /// Add request interceptor
  void addRequestInterceptor(RequestInterceptor interceptor) {
    _requestInterceptors.add(interceptor);
  }

  /// Add response interceptor
  void addResponseInterceptor(ResponseInterceptor interceptor) {
    _responseInterceptors.add(interceptor);
  }

  /// Remove request interceptor
  void removeRequestInterceptor(RequestInterceptor interceptor) {
    _requestInterceptors.remove(interceptor);
  }

  /// Remove response interceptor
  void removeResponseInterceptor(ResponseInterceptor interceptor) {
    _responseInterceptors.remove(interceptor);
  }

  /// Process request through all interceptors
  Future<NetworkRequest> processRequest(NetworkRequest request) async {
    NetworkRequest processedRequest = request;

    for (final interceptor in _requestInterceptors) {
      try {
        processedRequest = await interceptor.onRequest(processedRequest);
      } catch (error) {
        debugPrint('Request interceptor error: $error');
        // Continue with other interceptors
      }
    }

    return processedRequest;
  }

  /// Process response through all interceptors
  Future<NetworkResponse<T>> processResponse<T>(NetworkResponse<T> response) async {
    NetworkResponse<T> processedResponse = response;

    for (final interceptor in _responseInterceptors) {
      try {
        processedResponse = await interceptor.onResponse<T>(processedResponse);
      } catch (error) {
        debugPrint('Response interceptor error: $error');
        // Continue with other interceptors
      }
    }

    return processedResponse;
  }

  /// Clear all interceptors
  void clearAll() {
    _requestInterceptors.clear();
    _responseInterceptors.clear();
  }
}

/// Base request interceptor
abstract class RequestInterceptor {
  Future<NetworkRequest> onRequest(NetworkRequest request);
}

/// Base response interceptor
abstract class ResponseInterceptor {
  Future<NetworkResponse<T>> onResponse<T>(NetworkResponse<T> response);
}

/// Logging request interceptor
class LoggingRequestInterceptor extends RequestInterceptor {
  @override
  Future<NetworkRequest> onRequest(NetworkRequest request) async {
    if (NetworkConfig.instance.enableLogging) {
      final logLevel = NetworkConfig.instance.logLevel;
      
      if (logLevel.index >= LogLevel.debug.index) {
        debugPrint('🚀 REQUEST [${request.id}]');
        debugPrint('   Method: ${request.method.toUpperCase()}');
        debugPrint('   Path: ${request.path}');
        
        if (request.queryParameters?.isNotEmpty == true) {
          debugPrint('   Query: ${request.queryParameters}');
        }
        
        if (logLevel.index >= LogLevel.verbose.index) {
          if (request.headers?.isNotEmpty == true) {
            debugPrint('   Headers: ${_sanitizeHeaders(request.headers!)}');
          }
          
          if (request.data != null) {
            debugPrint('   Body: ${_sanitizeBody(request.data)}');
          }
        }
      }
    }
    
    return request;
  }

  Map<String, String> _sanitizeHeaders(Map<String, String> headers) {
    final sanitized = Map<String, String>.from(headers);
    
    // Hide sensitive headers
    const sensitiveKeys = ['authorization', 'x-api-key', 'x-client-secret'];
    for (final key in sensitiveKeys) {
      if (sanitized.containsKey(key)) {
        sanitized[key] = '***';
      }
    }
    
    return sanitized;
  }

  String _sanitizeBody(dynamic body) {
    if (body == null) return 'null';
    
    try {
      if (body is String) {
        final decoded = jsonDecode(body);
        return _sanitizeJsonObject(decoded).toString();
      } else {
        return _sanitizeJsonObject(body).toString();
      }
    } catch (e) {
      return body.toString();
    }
  }

  dynamic _sanitizeJsonObject(dynamic obj) {
    if (obj is Map<String, dynamic>) {
      final sanitized = <String, dynamic>{};
      for (final entry in obj.entries) {
        if (_isSensitiveField(entry.key)) {
          sanitized[entry.key] = '***';
        } else {
          sanitized[entry.key] = _sanitizeJsonObject(entry.value);
        }
      }
      return sanitized;
    } else if (obj is List) {
      return obj.map(_sanitizeJsonObject).toList();
    }
    return obj;
  }

  bool _isSensitiveField(String key) {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'pin'];
    return sensitiveFields.any((field) => 
        key.toLowerCase().contains(field));
  }
}

/// Authentication request interceptor
class AuthRequestInterceptor extends RequestInterceptor {
  // FIXED: AuthRequestInterceptor needs its own reference to authManager
  final UnifiedAuthManager _authManager = UnifiedAuthManager.instance;

  @override
  Future<NetworkRequest> onRequest(NetworkRequest request) async {
    // Check if token needs refresh
    if (_authManager.needsTokenRefresh && 
        NetworkConfig.instance.authConfig.autoRefreshToken) {
      // TODO: Implement token refresh logic
      debugPrint('Token needs refresh for request ${request.id}');
    }
    
    return request;
  }
}

/// Security request interceptor
class SecurityRequestInterceptor extends RequestInterceptor {
  @override
  Future<NetworkRequest> onRequest(NetworkRequest request) async {
    // Add security headers if not already present
    final headers = Map<String, String>.from(request.headers ?? {});
    
    // Add timestamp if not present
    if (!headers.containsKey('X-Timestamp')) {
      headers['X-Timestamp'] = DateTime.now().millisecondsSinceEpoch.toString();
    }
    
    // Add request ID for tracking
    if (!headers.containsKey('X-Request-ID')) {
      headers['X-Request-ID'] = request.id;
    }
    
    return request.copyWith(headers: headers);
  }
}

/// Logging response interceptor
class LoggingResponseInterceptor extends ResponseInterceptor {
  @override
  Future<NetworkResponse<T>> onResponse<T>(NetworkResponse<T> response) async {
    if (NetworkConfig.instance.enableLogging) {
      final logLevel = NetworkConfig.instance.logLevel;
      
      if (logLevel.index >= LogLevel.debug.index) {
        final statusIcon = response.isSuccess ? '✅' : '❌';
        debugPrint('$statusIcon RESPONSE [${response.requestId}]');
        debugPrint('   Status: ${response.statusCode} ${response.statusMessage ?? ''}');
        debugPrint('   Duration: ${response.duration?.inMilliseconds ?? 0}ms');
        
        if (response.isFromCache) {
          debugPrint('   Source: Cache');
        }
        
        if (!response.isSuccess && response.error != null) {
          debugPrint('   Error: ${response.error!.message}');
        }
        
        if (logLevel.index >= LogLevel.verbose.index) {
          if (response.headers?.isNotEmpty == true) {
            debugPrint('   Headers: ${response.headers}');
          }
          
          if (response.rawData != null) {
            debugPrint('   Data: ${_truncateData(response.rawData)}');
          }
        }
      }
    }
    
    return response;
  }

  String _truncateData(dynamic data, {int maxLength = 500}) {
    final dataString = data.toString();
    if (dataString.length <= maxLength) {
      return dataString;
    }
    return '${dataString.substring(0, maxLength)}... (truncated)';
  }
}

/// Authentication response interceptor
class AuthResponseInterceptor extends ResponseInterceptor {
  // FIXED: AuthResponseInterceptor needs its own reference to authManager
  final UnifiedAuthManager _authManager = UnifiedAuthManager.instance;

  @override
  Future<NetworkResponse<T>> onResponse<T>(NetworkResponse<T> response) async {
    // Handle authentication errors
    if (response.statusCode == 401) {
      debugPrint('Authentication error detected, clearing auth state');
      await _authManager.clearAuth();
    }
    
    // Handle token refresh responses
    if (response.isSuccess && response.rawData is Map<String, dynamic>) {
      final data = response.rawData as Map<String, dynamic>;
      
      // Check for new token in response
      if (data.containsKey('access_token') || data.containsKey('token')) {
        final token = data['access_token'] ?? data['token'];
        final refreshToken = data['refresh_token'];
        
        if (token is String) {
          DateTime? expiresAt;
          if (data.containsKey('expires_in')) {
            final expiresIn = data['expires_in'];
            if (expiresIn is int) {
              expiresAt = DateTime.now().add(Duration(seconds: expiresIn));
            }
          }
          
          await _authManager.setToken(
            token,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
          );
          
          debugPrint('Token updated from response');
        }
      }
    }
    
    return response;
  }
}

/// Error response interceptor
class ErrorResponseInterceptor extends ResponseInterceptor {
  @override
  Future<NetworkResponse<T>> onResponse<T>(NetworkResponse<T> response) async {
    if (!response.isSuccess) {
      // Log error details
      if (NetworkConfig.instance.logLevel.index >= LogLevel.error.index) {
        debugPrint('❌ ERROR [${response.requestId}]');
        debugPrint('   Status: ${response.statusCode}');
        debugPrint('   Message: ${response.message}');
        if (response.error != null) {
          debugPrint('   Error Type: ${response.error!.type}');
          debugPrint('   Error Details: ${response.error!.details}');
        }
      }
      
      // Handle specific error cases
      switch (response.statusCode) {
        case 429:
          debugPrint('Rate limit exceeded, consider implementing backoff');
          break;
        case 503:
          debugPrint('Service unavailable, server may be down');
          break;
        case 500:
        case 502:
        case 504:
          debugPrint('Server error, may be temporary');
          break;
      }
    }
    
    return response;
  }
}
