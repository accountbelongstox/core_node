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

abstract class ErrorInterceptorInterface {
  Future<NetworkError> processError(dynamic error, int? statusCode, String? responseBody);
  bool shouldRetry(NetworkError error, int attemptCount);
  Duration getRetryDelay(int attemptCount);
  void onError(NetworkError error);
}

enum NetworkErrorType {
  timeout,
  noConnection,
  serverError,
  clientError,
  authenticationError,
  authorizationError,
  notFound,
  badRequest,
  conflict,
  tooManyRequests,
  serviceUnavailable,
  unknown
}

class NetworkError {
  final NetworkErrorType type;
  final int? statusCode;
  final String message;
  final String? details;
  final dynamic originalError;
  final DateTime timestamp;
  final String? requestUrl;
  final Map<String, dynamic>? responseData;

  const NetworkError({
    required this.type,
    this.statusCode,
    required this.message,
    this.details,
    this.originalError,
    required this.timestamp,
    this.requestUrl,
    this.responseData,
  });

  bool get isRetryable {
    switch (type) {
      case NetworkErrorType.timeout:
      case NetworkErrorType.noConnection:
      case NetworkErrorType.serverError:
      case NetworkErrorType.serviceUnavailable:
      case NetworkErrorType.tooManyRequests:
        return true;
      default:
        return false;
    }
  }

  bool get isAuthError {
    return type == NetworkErrorType.authenticationError || 
           type == NetworkErrorType.authorizationError;
  }

  @override
  String toString() {
    return 'NetworkError(type: $type, statusCode: $statusCode, message: $message)';
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type.name,
      'statusCode': statusCode,
      'message': message,
      'details': details,
      'timestamp': timestamp.toIso8601String(),
      'requestUrl': requestUrl,
      'responseData': responseData,
    };
  }
}

class ErrorInterceptor implements ErrorInterceptorInterface {
  static ErrorInterceptor? _instance;
  static ErrorInterceptor get instance => _instance ??= ErrorInterceptor._internal();
  
  ErrorInterceptor._internal();

  // Configuration
  int maxRetryAttempts = 3;
  Duration baseRetryDelay = Duration(seconds: 1);
  bool enableExponentialBackoff = true;
  
  // Error callbacks
  Function(NetworkError error)? onNetworkError;
  Function(NetworkError error)? onAuthError;
  Function(NetworkError error)? onServerError;
  Function(NetworkError error)? onClientError;

  @override
  Future<NetworkError> processError(dynamic error, int? statusCode, String? responseBody) async {
    final timestamp = DateTime.now();
    NetworkErrorType errorType;
    String message;
    String? details;
    Map<String, dynamic>? responseData;

    // Parse response body if available
    if (responseBody != null && responseBody.isNotEmpty) {
      try {
        responseData = json.decode(responseBody) as Map<String, dynamic>?;
      } catch (e) {
        // Response body is not valid JSON
        details = responseBody;
      }
    }

    // Determine error type based on status code
    if (statusCode != null) {
      errorType = _getErrorTypeFromStatusCode(statusCode);
      message = _getMessageFromStatusCode(statusCode);
      
      // Try to get more specific message from response
      if (responseData != null) {
        final responseMessage = responseData['message'] ?? 
                               responseData['error'] ?? 
                               responseData['detail'];
        if (responseMessage != null) {
          details = responseMessage.toString();
        }
      }
    } else {
      // Handle non-HTTP errors
      errorType = _getErrorTypeFromException(error);
      message = _getMessageFromException(error);
      details = error?.toString();
    }

    final networkError = NetworkError(
      type: errorType,
      statusCode: statusCode,
      message: message,
      details: details,
      originalError: error,
      timestamp: timestamp,
      responseData: responseData,
    );

    // Log error
    if (kDebugMode) {
      print('Network Error: ${networkError.toString()}');
      if (details != null) {
        print('Error Details: $details');
      }
    }

    return networkError;
  }

  @override
  bool shouldRetry(NetworkError error, int attemptCount) {
    if (attemptCount >= maxRetryAttempts) {
      return false;
    }

    return error.isRetryable;
  }

  @override
  Duration getRetryDelay(int attemptCount) {
    if (enableExponentialBackoff) {
      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      final delaySeconds = baseRetryDelay.inSeconds * (1 << (attemptCount - 1));
      return Duration(seconds: delaySeconds.clamp(1, 60)); // Max 60 seconds
    } else {
      return baseRetryDelay;
    }
  }

  @override
  void onError(NetworkError error) {
    // Call appropriate error callback
    onNetworkError?.call(error);

    switch (error.type) {
      case NetworkErrorType.authenticationError:
      case NetworkErrorType.authorizationError:
        onAuthError?.call(error);
        break;
      case NetworkErrorType.serverError:
      case NetworkErrorType.serviceUnavailable:
        onServerError?.call(error);
        break;
      case NetworkErrorType.badRequest:
      case NetworkErrorType.notFound:
      case NetworkErrorType.conflict:
        onClientError?.call(error);
        break;
      default:
        break;
    }
  }

  NetworkErrorType _getErrorTypeFromStatusCode(int statusCode) {
    switch (statusCode) {
      case 400:
        return NetworkErrorType.badRequest;
      case 401:
        return NetworkErrorType.authenticationError;
      case 403:
        return NetworkErrorType.authorizationError;
      case 404:
        return NetworkErrorType.notFound;
      case 409:
        return NetworkErrorType.conflict;
      case 429:
        return NetworkErrorType.tooManyRequests;
      case 503:
        return NetworkErrorType.serviceUnavailable;
      default:
        if (statusCode >= 400 && statusCode < 500) {
          return NetworkErrorType.clientError;
        } else if (statusCode >= 500) {
          return NetworkErrorType.serverError;
        } else {
          return NetworkErrorType.unknown;
        }
    }
  }

  String _getMessageFromStatusCode(int statusCode) {
    switch (statusCode) {
      case 400:
        return 'Bad Request';
      case 401:
        return 'Authentication Required';
      case 403:
        return 'Access Forbidden';
      case 404:
        return 'Resource Not Found';
      case 409:
        return 'Conflict';
      case 429:
        return 'Too Many Requests';
      case 500:
        return 'Internal Server Error';
      case 502:
        return 'Bad Gateway';
      case 503:
        return 'Service Unavailable';
      case 504:
        return 'Gateway Timeout';
      default:
        if (statusCode >= 400 && statusCode < 500) {
          return 'Client Error ($statusCode)';
        } else if (statusCode >= 500) {
          return 'Server Error ($statusCode)';
        } else {
          return 'HTTP Error ($statusCode)';
        }
    }
  }

  NetworkErrorType _getErrorTypeFromException(dynamic error) {
    final errorString = error.toString().toLowerCase();
    
    if (errorString.contains('timeout') || errorString.contains('timed out')) {
      return NetworkErrorType.timeout;
    } else if (errorString.contains('connection') || 
               errorString.contains('network') ||
               errorString.contains('socket')) {
      return NetworkErrorType.noConnection;
    } else {
      return NetworkErrorType.unknown;
    }
  }

  String _getMessageFromException(dynamic error) {
    final errorString = error.toString().toLowerCase();
    
    if (errorString.contains('timeout') || errorString.contains('timed out')) {
      return 'Request Timeout';
    } else if (errorString.contains('connection')) {
      return 'Connection Error';
    } else if (errorString.contains('network')) {
      return 'Network Error';
    } else if (errorString.contains('socket')) {
      return 'Socket Error';
    } else {
      return 'Unknown Error';
    }
  }

  /// Get user-friendly error message
  String getUserFriendlyMessage(NetworkError error) {
    switch (error.type) {
      case NetworkErrorType.noConnection:
        return 'Please check your internet connection and try again.';
      case NetworkErrorType.timeout:
        return 'Request timed out. Please try again.';
      case NetworkErrorType.serverError:
        return 'Server error occurred. Please try again later.';
      case NetworkErrorType.serviceUnavailable:
        return 'Service is temporarily unavailable. Please try again later.';
      case NetworkErrorType.authenticationError:
        return 'Please log in to continue.';
      case NetworkErrorType.authorizationError:
        return 'You do not have permission to access this resource.';
      case NetworkErrorType.notFound:
        return 'The requested resource was not found.';
      case NetworkErrorType.badRequest:
        return error.details ?? 'Invalid request. Please check your input.';
      case NetworkErrorType.conflict:
        return error.details ?? 'A conflict occurred. Please try again.';
      case NetworkErrorType.tooManyRequests:
        return 'Too many requests. Please wait a moment and try again.';
      default:
        return error.details ?? 'An unexpected error occurred. Please try again.';
    }
  }

  /// Check if error indicates offline status
  bool isOfflineError(NetworkError error) {
    return error.type == NetworkErrorType.noConnection ||
           error.type == NetworkErrorType.timeout;
  }

  /// Get retry suggestion for user
  String getRetrySuggestion(NetworkError error, int attemptCount) {
    if (!error.isRetryable) {
      return 'This error cannot be resolved by retrying.';
    }

    if (attemptCount >= maxRetryAttempts) {
      return 'Maximum retry attempts reached. Please try again later.';
    }

    final delay = getRetryDelay(attemptCount + 1);
    return 'Retrying in ${delay.inSeconds} seconds...';
  }
}
