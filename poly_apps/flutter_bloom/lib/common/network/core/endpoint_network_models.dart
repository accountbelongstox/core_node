// FIXED: Removed unused 'dart:convert' import
import 'package:flutter/foundation.dart';
import 'network_config.dart';
// Fix: Import all shared types from network_types.dart to use unified definitions
import 'network_types.dart' show CancelToken, RequestPriority, CacheStrategy;

/// Network request model
class NetworkRequest {
  final String id;
  final String method;
  final String path;
  final Map<String, dynamic>? queryParameters;
  final dynamic data;
  final Map<String, String>? headers;
  final EndpointGroup? endpointGroup;
  final Duration? timeout;
  final bool? enableCache;
  final Duration? cacheDuration;
  final CacheStrategy? cacheStrategy;
  final int? maxRetries;
  final RequestPriority priority;
  final bool enableQueue;
  final Map<String, dynamic>? metadata;
  final Function(int sent, int total)? onSendProgress;
  final Function(int received, int total)? onReceiveProgress;
  final CancelToken? cancelToken;

  NetworkRequest({
    String? id,
    required this.method,
    required this.path,
    this.queryParameters,
    this.data,
    this.headers,
    this.endpointGroup,
    this.timeout,
    this.enableCache,
    this.cacheDuration,
    this.cacheStrategy,
    this.maxRetries,
    this.priority = RequestPriority.normal,
    this.enableQueue = true,
    this.metadata,
    this.onSendProgress,
    this.onReceiveProgress,
    this.cancelToken,
  }) : id = id ?? _generateRequestId();

  static String _generateRequestId() {
    return '${DateTime.now().millisecondsSinceEpoch}_${UniqueKey().toString()}';
  }

  /// Create cache key for this request
  String get cacheKey {
    final uri = Uri(
      path: path,
      queryParameters: queryParameters?.map((k, v) => MapEntry(k, v.toString())),
    );
    final dataHash = data != null ? data.hashCode : 0;
    return '${method.toUpperCase()}_${uri.toString()}_$dataHash';
  }

  /// Check if this request should be cached
  bool get shouldCache {
    if (enableCache == false) return false;
    if (endpointGroup?.enableCache == false) return false;
    if (method.toUpperCase() != 'GET') return false;
    return enableCache ?? endpointGroup?.enableCache ?? NetworkConfig.instance.enableCache;
  }

  /// Get effective cache duration
  Duration get effectiveCacheDuration {
    return cacheDuration ?? 
           endpointGroup?.cacheDuration ?? 
           NetworkConfig.instance.defaultCacheDuration;
  }

  /// Get effective timeout
  Duration get effectiveTimeout {
    return timeout ?? 
           endpointGroup?.timeout ?? 
           NetworkConfig.instance.connectTimeout;
  }

  /// Get effective max retries
  int get effectiveMaxRetries {
    return maxRetries ?? 
           endpointGroup?.maxRetries ?? 
           NetworkConfig.instance.maxRetries;
  }

  NetworkRequest copyWith({
    String? id,
    String? method,
    String? path,
    Map<String, dynamic>? queryParameters,
    dynamic data,
    Map<String, String>? headers,
    EndpointGroup? endpointGroup,
    Duration? timeout,
    bool? enableCache,
    Duration? cacheDuration,
    CacheStrategy? cacheStrategy,
    int? maxRetries,
    RequestPriority? priority,
    bool? enableQueue,
    Map<String, dynamic>? metadata,
    Function(int sent, int total)? onSendProgress,
    Function(int received, int total)? onReceiveProgress,
    CancelToken? cancelToken,
  }) {
    return NetworkRequest(
      id: id ?? this.id,
      method: method ?? this.method,
      path: path ?? this.path,
      queryParameters: queryParameters ?? this.queryParameters,
      data: data ?? this.data,
      headers: headers ?? this.headers,
      endpointGroup: endpointGroup ?? this.endpointGroup,
      timeout: timeout ?? this.timeout,
      enableCache: enableCache ?? this.enableCache,
      cacheDuration: cacheDuration ?? this.cacheDuration,
      cacheStrategy: cacheStrategy ?? this.cacheStrategy,
      maxRetries: maxRetries ?? this.maxRetries,
      priority: priority ?? this.priority,
      enableQueue: enableQueue ?? this.enableQueue,
      metadata: metadata ?? this.metadata,
      onSendProgress: onSendProgress ?? this.onSendProgress,
      onReceiveProgress: onReceiveProgress ?? this.onReceiveProgress,
      cancelToken: cancelToken ?? this.cancelToken,
    );
  }
}

/// Network response model
class NetworkResponse<T> {
  final String requestId;
  final int statusCode;
  final String? statusMessage;
  final T? data;
  final Map<String, dynamic>? rawData;
  final Map<String, String>? headers;
  final bool isSuccess;
  final String? message;
  final String? errorCode;
  final NetworkError? error;
  final bool isFromCache;
  final DateTime timestamp;
  final Duration? duration;
  final Map<String, dynamic>? metadata;

  const NetworkResponse({
    required this.requestId,
    required this.statusCode,
    this.statusMessage,
    this.data,
    this.rawData,
    this.headers,
    required this.isSuccess,
    this.message,
    this.errorCode,
    this.error,
    this.isFromCache = false,
    required this.timestamp,
    this.duration,
    this.metadata,
  });

  factory NetworkResponse.success({
    required String requestId,
    required int statusCode,
    String? statusMessage,
    T? data,
    Map<String, dynamic>? rawData,
    Map<String, String>? headers,
    String? message,
    bool isFromCache = false,
    DateTime? timestamp,
    Duration? duration,
    Map<String, dynamic>? metadata,
  }) {
    return NetworkResponse<T>(
      requestId: requestId,
      statusCode: statusCode,
      statusMessage: statusMessage,
      data: data,
      rawData: rawData,
      headers: headers,
      isSuccess: true,
      message: message,
      isFromCache: isFromCache,
      timestamp: timestamp ?? DateTime.now(),
      duration: duration,
      metadata: metadata,
    );
  }

  factory NetworkResponse.error({
    required String requestId,
    required int statusCode,
    String? statusMessage,
    Map<String, dynamic>? rawData,
    Map<String, String>? headers,
    String? message,
    String? errorCode,
    NetworkError? error,
    DateTime? timestamp,
    Duration? duration,
    Map<String, dynamic>? metadata,
  }) {
    return NetworkResponse<T>(
      requestId: requestId,
      statusCode: statusCode,
      statusMessage: statusMessage,
      rawData: rawData,
      headers: headers,
      isSuccess: false,
      message: message,
      errorCode: errorCode,
      error: error,
      timestamp: timestamp ?? DateTime.now(),
      duration: duration,
      metadata: metadata,
    );
  }

  NetworkResponse<R> copyWith<R>({
    String? requestId,
    int? statusCode,
    String? statusMessage,
    R? data,
    Map<String, dynamic>? rawData,
    Map<String, String>? headers,
    bool? isSuccess,
    String? message,
    String? errorCode,
    NetworkError? error,
    bool? isFromCache,
    DateTime? timestamp,
    Duration? duration,
    Map<String, dynamic>? metadata,
  }) {
    return NetworkResponse<R>(
      requestId: requestId ?? this.requestId,
      statusCode: statusCode ?? this.statusCode,
      statusMessage: statusMessage ?? this.statusMessage,
      data: data ?? (this.data as R?),
      rawData: rawData ?? this.rawData,
      headers: headers ?? this.headers,
      isSuccess: isSuccess ?? this.isSuccess,
      message: message ?? this.message,
      errorCode: errorCode ?? this.errorCode,
      error: error ?? this.error,
      isFromCache: isFromCache ?? this.isFromCache,
      timestamp: timestamp ?? this.timestamp,
      duration: duration ?? this.duration,
      metadata: metadata ?? this.metadata,
    );
  }
}

/// Network error model
class NetworkError {
  final NetworkErrorType type;
  final String message;
  final String? code;
  final int? statusCode;
  final dynamic originalError;
  final StackTrace? stackTrace;
  final Map<String, dynamic>? details;

  const NetworkError({
    required this.type,
    required this.message,
    this.code,
    this.statusCode,
    this.originalError,
    this.stackTrace,
    this.details,
  });

  factory NetworkError.timeout({String? message}) {
    return NetworkError(
      type: NetworkErrorType.timeout,
      message: message ?? 'Request timeout',
    );
  }

  factory NetworkError.connection({String? message}) {
    return NetworkError(
      type: NetworkErrorType.connection,
      message: message ?? 'Connection error',
    );
  }

  factory NetworkError.server({
    required int statusCode,
    String? message,
    String? code,
    Map<String, dynamic>? details,
  }) {
    return NetworkError(
      type: NetworkErrorType.server,
      message: message ?? 'Server error',
      code: code,
      statusCode: statusCode,
      details: details,
    );
  }

  factory NetworkError.parsing({
    String? message,
    dynamic originalError,
    StackTrace? stackTrace,
  }) {
    return NetworkError(
      type: NetworkErrorType.parsing,
      message: message ?? 'Data parsing error',
      originalError: originalError,
      stackTrace: stackTrace,
    );
  }

  factory NetworkError.authentication({String? message, String? code}) {
    return NetworkError(
      type: NetworkErrorType.authentication,
      message: message ?? 'Authentication error',
      code: code,
    );
  }

  factory NetworkError.authorization({String? message, String? code}) {
    return NetworkError(
      type: NetworkErrorType.authorization,
      message: message ?? 'Authorization error',
      code: code,
    );
  }

  factory NetworkError.unknown({
    String? message,
    dynamic originalError,
    StackTrace? stackTrace,
  }) {
    return NetworkError(
      type: NetworkErrorType.unknown,
      message: message ?? 'Unknown error',
      originalError: originalError,
      stackTrace: stackTrace,
    );
  }

  @override
  String toString() {
    return 'NetworkError(type: $type, message: $message, code: $code, statusCode: $statusCode)';
  }
}

/// Network error types
enum NetworkErrorType {
  timeout,
  connection,
  server,
  parsing,
  authentication,
  authorization,
  validation,
  rateLimit,
  unknown,
}

// REMOVED: Duplicate CancelToken class
// Use CancelToken from network_types.dart instead
// This was a simpler version without listener support

/// Cache entry model
class CacheEntry<T> {
  final String key;
  final T data;
  final DateTime createdAt;
  final Duration duration;
  final Map<String, dynamic>? metadata;

  const CacheEntry({
    required this.key,
    required this.data,
    required this.createdAt,
    required this.duration,
    this.metadata,
  });

  bool get isExpired {
    return DateTime.now().isAfter(createdAt.add(duration));
  }

  DateTime get expiresAt {
    return createdAt.add(duration);
  }

  Map<String, dynamic> toJson() {
    return {
      'key': key,
      'data': data,
      'createdAt': createdAt.toIso8601String(),
      'duration': duration.inMilliseconds,
      'metadata': metadata,
    };
  }

  factory CacheEntry.fromJson(Map<String, dynamic> json) {
    return CacheEntry<T>(
      key: json['key'],
      data: json['data'],
      createdAt: DateTime.parse(json['createdAt']),
      duration: Duration(milliseconds: json['duration']),
      metadata: json['metadata'],
    );
  }
}
