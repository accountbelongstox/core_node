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
import 'package:flutter/foundation.dart';

abstract class LoggingInterceptorInterface {
  void logRequest(String method, String url, Map<String, String>? headers, dynamic body);
  void logResponse(String method, String url, int statusCode, Map<String, String>? headers, dynamic body, Duration duration);
  void logError(String method, String url, dynamic error, Duration duration);
}

enum LogLevel {
  none,
  basic,
  headers,
  body,
  all
}

class LoggingInterceptor implements LoggingInterceptorInterface {
  static LoggingInterceptor? _instance;
  static LoggingInterceptor get instance => _instance ??= LoggingInterceptor._internal();
  
  LoggingInterceptor._internal();

  LogLevel logLevel = kDebugMode ? LogLevel.all : LogLevel.none;
  bool logRequestHeaders = true;
  bool logRequestBody = true;
  bool logResponseHeaders = true;
  bool logResponseBody = true;
  bool logErrors = true;
  int maxBodyLength = 1000; // Maximum characters to log for request/response body
  
  // Sensitive headers that should be masked
  final Set<String> sensitiveHeaders = {
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'bearer',
    'auth-token',
    'access-token',
    'refresh-token',
  };

  // Content types that should have their body logged
  final Set<String> loggableContentTypes = {
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
    'text/html',
    'text/xml',
    'application/xml',
  };

  @override
  void logRequest(String method, String url, Map<String, String>? headers, dynamic body) {
    if (logLevel == LogLevel.none) return;

    final buffer = StringBuffer();
    buffer.writeln('🚀 REQUEST [$method] $url');
    
    if (logLevel == LogLevel.all || logLevel == LogLevel.headers) {
      if (headers != null && headers.isNotEmpty && logRequestHeaders) {
        buffer.writeln('📋 Headers:');
        headers.forEach((key, value) {
          final maskedValue = _shouldMaskHeader(key) ? _maskValue(value) : value;
          buffer.writeln('   $key: $maskedValue');
        });
      }
    }

    if (logLevel == LogLevel.all || logLevel == LogLevel.body) {
      if (body != null && logRequestBody) {
        final contentType = headers?['content-type'] ?? '';
        if (_shouldLogBody(contentType)) {
          buffer.writeln('📦 Body:');
          buffer.writeln(_formatBody(body));
        } else {
          buffer.writeln('📦 Body: [Binary or non-loggable content]');
        }
      }
    }

    if (kDebugMode) {
      print(buffer.toString());
    }
  }

  @override
  void logResponse(String method, String url, int statusCode, Map<String, String>? headers, dynamic body, Duration duration) {
    if (logLevel == LogLevel.none) return;

    final buffer = StringBuffer();
    final statusEmoji = _getStatusEmoji(statusCode);
    buffer.writeln('$statusEmoji RESPONSE [$method] $url');
    buffer.writeln('⏱️  Duration: ${duration.inMilliseconds}ms');
    buffer.writeln('📊 Status: $statusCode ${_getStatusText(statusCode)}');

    if (logLevel == LogLevel.all || logLevel == LogLevel.headers) {
      if (headers != null && headers.isNotEmpty && logResponseHeaders) {
        buffer.writeln('📋 Headers:');
        headers.forEach((key, value) {
          final maskedValue = _shouldMaskHeader(key) ? _maskValue(value) : value;
          buffer.writeln('   $key: $maskedValue');
        });
      }
    }

    if (logLevel == LogLevel.all || logLevel == LogLevel.body) {
      if (body != null && logResponseBody) {
        final contentType = headers?['content-type'] ?? '';
        if (_shouldLogBody(contentType)) {
          buffer.writeln('📦 Body:');
          buffer.writeln(_formatBody(body));
        } else {
          buffer.writeln('📦 Body: [Binary or non-loggable content]');
        }
      }
    }

    if (kDebugMode) {
      print(buffer.toString());
    }
  }

  @override
  void logError(String method, String url, dynamic error, Duration duration) {
    if (logLevel == LogLevel.none || !logErrors) return;

    final buffer = StringBuffer();
    buffer.writeln('❌ ERROR [$method] $url');
    buffer.writeln('⏱️  Duration: ${duration.inMilliseconds}ms');
    buffer.writeln('🚨 Error: $error');

    if (kDebugMode) {
      print(buffer.toString());
    }
  }

  bool _shouldMaskHeader(String headerName) {
    return sensitiveHeaders.contains(headerName.toLowerCase());
  }

  String _maskValue(String value) {
    if (value.length <= 8) {
      return '***';
    }
    return '${value.substring(0, 4)}***${value.substring(value.length - 4)}';
  }

  bool _shouldLogBody(String contentType) {
    final lowerContentType = contentType.toLowerCase();
    return loggableContentTypes.any((type) => lowerContentType.contains(type));
  }

  String _formatBody(dynamic body) {
    if (body == null) return 'null';

    String bodyString;
    if (body is String) {
      bodyString = body;
    } else if (body is Map || body is List) {
      try {
        bodyString = JsonEncoder.withIndent('  ').convert(body);
      } catch (e) {
        bodyString = body.toString();
      }
    } else {
      bodyString = body.toString();
    }

    // Truncate if too long
    if (bodyString.length > maxBodyLength) {
      bodyString = '${bodyString.substring(0, maxBodyLength)}... [truncated]';
    }

    return bodyString;
  }

  String _getStatusEmoji(int statusCode) {
    if (statusCode >= 200 && statusCode < 300) {
      return '✅'; // Success
    } else if (statusCode >= 300 && statusCode < 400) {
      return '🔄'; // Redirect
    } else if (statusCode >= 400 && statusCode < 500) {
      return '⚠️'; // Client error
    } else if (statusCode >= 500) {
      return '💥'; // Server error
    } else {
      return '❓'; // Unknown
    }
  }

  String _getStatusText(int statusCode) {
    switch (statusCode) {
      case 200: return 'OK';
      case 201: return 'Created';
      case 202: return 'Accepted';
      case 204: return 'No Content';
      case 301: return 'Moved Permanently';
      case 302: return 'Found';
      case 304: return 'Not Modified';
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 405: return 'Method Not Allowed';
      case 409: return 'Conflict';
      case 422: return 'Unprocessable Entity';
      case 429: return 'Too Many Requests';
      case 500: return 'Internal Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      case 504: return 'Gateway Timeout';
      default: return '';
    }
  }

  /// Set log level
  void setLogLevel(LogLevel level) {
    logLevel = level;
    if (kDebugMode) {
      print('🔧 Logging level set to: ${level.name}');
    }
  }

  /// Enable/disable specific logging features
  void configure({
    bool? requestHeaders,
    bool? requestBody,
    bool? responseHeaders,
    bool? responseBody,
    bool? errors,
    int? maxBodyLength,
  }) {
    if (requestHeaders != null) logRequestHeaders = requestHeaders;
    if (requestBody != null) logRequestBody = requestBody;
    if (responseHeaders != null) logResponseHeaders = responseHeaders;
    if (responseBody != null) logResponseBody = responseBody;
    if (errors != null) logErrors = errors;
    if (maxBodyLength != null) this.maxBodyLength = maxBodyLength;

    if (kDebugMode) {
      print('🔧 Logging configuration updated');
    }
  }

  /// Add sensitive header name
  void addSensitiveHeader(String headerName) {
    sensitiveHeaders.add(headerName.toLowerCase());
  }

  /// Remove sensitive header name
  void removeSensitiveHeader(String headerName) {
    sensitiveHeaders.remove(headerName.toLowerCase());
  }

  /// Add loggable content type
  void addLoggableContentType(String contentType) {
    loggableContentTypes.add(contentType.toLowerCase());
  }

  /// Remove loggable content type
  void removeLoggableContentType(String contentType) {
    loggableContentTypes.remove(contentType.toLowerCase());
  }

  /// Log custom message
  void logCustom(String message, {String emoji = '📝'}) {
    if (logLevel == LogLevel.none) return;
    
    if (kDebugMode) {
      print('$emoji $message');
    }
  }

  /// Log network statistics
  void logStats({
    required int totalRequests,
    required int successfulRequests,
    required int failedRequests,
    required Duration averageResponseTime,
  }) {
    if (logLevel == LogLevel.none) return;

    final buffer = StringBuffer();
    buffer.writeln('📈 NETWORK STATISTICS');
    buffer.writeln('   Total Requests: $totalRequests');
    buffer.writeln('   Successful: $successfulRequests');
    buffer.writeln('   Failed: $failedRequests');
    buffer.writeln('   Success Rate: ${((successfulRequests / totalRequests) * 100).toStringAsFixed(1)}%');
    buffer.writeln('   Average Response Time: ${averageResponseTime.inMilliseconds}ms');

    if (kDebugMode) {
      print(buffer.toString());
    }
  }
}
