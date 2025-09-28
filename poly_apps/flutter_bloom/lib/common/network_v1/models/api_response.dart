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
import 'dart:crypto';

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final String? error;
  final int? statusCode;
  final Map<String, dynamic>? metadata;
  final DateTime timestamp;

  const ApiResponse({
    required this.success,
    this.data,
    this.message,
    this.error,
    this.statusCode,
    this.metadata,
    required this.timestamp,
  });

  /// Create successful response
  factory ApiResponse.success({
    required T data,
    String? message,
    int? statusCode,
    Map<String, dynamic>? metadata,
  }) {
    return ApiResponse<T>(
      success: true,
      data: data,
      message: message,
      statusCode: statusCode,
      metadata: metadata,
      timestamp: DateTime.now(),
    );
  }

  /// Create error response
  factory ApiResponse.error({
    required String error,
    String? message,
    int? statusCode,
    Map<String, dynamic>? metadata,
  }) {
    return ApiResponse<T>(
      success: false,
      error: error,
      message: message,
      statusCode: statusCode,
      metadata: metadata,
      timestamp: DateTime.now(),
    );
  }

  /// Create response from JSON
  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromJsonT,
  ) {
    return ApiResponse<T>(
      success: json['success'] as bool? ?? false,
      data: json['data'] != null && fromJsonT != null 
          ? fromJsonT(json['data']) 
          : json['data'] as T?,
      message: json['message'] as String?,
      error: json['error'] as String?,
      statusCode: json['statusCode'] as int?,
      metadata: json['metadata'] as Map<String, dynamic>?,
      timestamp: json['timestamp'] != null 
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now(),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson([dynamic Function(T)? toJsonT]) {
    return {
      'success': success,
      'data': data != null && toJsonT != null ? toJsonT(data as T) : data,
      'message': message,
      'error': error,
      'statusCode': statusCode,
      'metadata': metadata,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  /// Check if response has data
  bool get hasData => data != null;

  /// Check if response has error
  bool get hasError => error != null;

  /// Get data or throw exception
  T get dataOrThrow {
    if (success && data != null) {
      return data as T;
    }
    throw ApiException(
      message: error ?? message ?? 'Unknown error',
      statusCode: statusCode,
    );
  }

  /// Get data or return default value
  T dataOr(T defaultValue) {
    return data ?? defaultValue;
  }

  /// Transform data to another type
  ApiResponse<R> map<R>(R Function(T) transform) {
    if (success && data != null) {
      try {
        final transformedData = transform(data as T);
        return ApiResponse<R>(
          success: true,
          data: transformedData,
          message: message,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
        );
      } catch (e) {
        return ApiResponse<R>(
          success: false,
          error: 'Data transformation failed: $e',
          message: message,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
        );
      }
    } else {
      return ApiResponse<R>(
        success: false,
        error: error,
        message: message,
        statusCode: statusCode,
        metadata: metadata,
        timestamp: timestamp,
      );
    }
  }

  /// Copy with new values
  ApiResponse<T> copyWith({
    bool? success,
    T? data,
    String? message,
    String? error,
    int? statusCode,
    Map<String, dynamic>? metadata,
    DateTime? timestamp,
  }) {
    return ApiResponse<T>(
      success: success ?? this.success,
      data: data ?? this.data,
      message: message ?? this.message,
      error: error ?? this.error,
      statusCode: statusCode ?? this.statusCode,
      metadata: metadata ?? this.metadata,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  @override
  String toString() {
    return 'ApiResponse(success: $success, data: $data, message: $message, error: $error, statusCode: $statusCode)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ApiResponse<T> &&
        other.success == success &&
        other.data == data &&
        other.message == message &&
        other.error == error &&
        other.statusCode == statusCode;
  }

  @override
  int get hashCode {
    return success.hashCode ^
        data.hashCode ^
        message.hashCode ^
        error.hashCode ^
        statusCode.hashCode;
  }
}

/// Paginated API response
class PaginatedResponse<T> extends ApiResponse<List<T>> {
  final int currentPage;
  final int totalPages;
  final int totalItems;
  final int itemsPerPage;
  final bool hasNextPage;
  final bool hasPreviousPage;

  const PaginatedResponse({
    required bool success,
    required List<T>? data,
    String? message,
    String? error,
    int? statusCode,
    Map<String, dynamic>? metadata,
    required DateTime timestamp,
    required this.currentPage,
    required this.totalPages,
    required this.totalItems,
    required this.itemsPerPage,
    required this.hasNextPage,
    required this.hasPreviousPage,
  }) : super(
          success: success,
          data: data,
          message: message,
          error: error,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
        );

  /// Create successful paginated response
  factory PaginatedResponse.success({
    required List<T> data,
    required int currentPage,
    required int totalPages,
    required int totalItems,
    required int itemsPerPage,
    String? message,
    int? statusCode,
    Map<String, dynamic>? metadata,
  }) {
    return PaginatedResponse<T>(
      success: true,
      data: data,
      message: message,
      statusCode: statusCode,
      metadata: metadata,
      timestamp: DateTime.now(),
      currentPage: currentPage,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    );
  }

  /// Create error paginated response
  factory PaginatedResponse.error({
    required String error,
    String? message,
    int? statusCode,
    Map<String, dynamic>? metadata,
  }) {
    return PaginatedResponse<T>(
      success: false,
      data: null,
      error: error,
      message: message,
      statusCode: statusCode,
      metadata: metadata,
      timestamp: DateTime.now(),
      currentPage: 0,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    );
  }

  /// Create from JSON
  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic) fromJsonT,
  ) {
    final dataList = json['data'] as List<dynamic>?;
    final items = dataList?.map((item) => fromJsonT(item)).toList();
    
    final pagination = json['pagination'] as Map<String, dynamic>? ?? {};
    final currentPage = pagination['currentPage'] as int? ?? 1;
    final totalPages = pagination['totalPages'] as int? ?? 1;
    final totalItems = pagination['totalItems'] as int? ?? 0;
    final itemsPerPage = pagination['itemsPerPage'] as int? ?? 10;

    return PaginatedResponse<T>(
      success: json['success'] as bool? ?? false,
      data: items,
      message: json['message'] as String?,
      error: json['error'] as String?,
      statusCode: json['statusCode'] as int?,
      metadata: json['metadata'] as Map<String, dynamic>?,
      timestamp: json['timestamp'] != null 
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now(),
      currentPage: currentPage,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    );
  }

  /// Convert to JSON
  @override
  Map<String, dynamic> toJson([dynamic Function(List<T>)? toJsonT]) {
    final baseJson = super.toJson(toJsonT);
    baseJson['pagination'] = {
      'currentPage': currentPage,
      'totalPages': totalPages,
      'totalItems': totalItems,
      'itemsPerPage': itemsPerPage,
      'hasNextPage': hasNextPage,
      'hasPreviousPage': hasPreviousPage,
    };
    return baseJson;
  }

  /// Get pagination info as typed object
  PaginationInfo get paginationInfo {
    return PaginationInfo(
      currentPage: currentPage,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: itemsPerPage,
      hasNextPage: hasNextPage,
      hasPreviousPage: hasPreviousPage,
    );
  }

  @override
  String toString() {
    return 'PaginatedResponse(success: $success, items: ${data?.length ?? 0}, currentPage: $currentPage, totalPages: $totalPages, totalItems: $totalItems)';
  }
}

/// API Exception
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final Map<String, dynamic>? details;
  final NetworkErrorType? errorType;
  final String? requestId;

  const ApiException({
    required this.message,
    this.statusCode,
    this.details,
    this.errorType,
    this.requestId,
  });

  factory ApiException.fromResponse(ApiResponse response) {
    return ApiException(
      message: response.error ?? response.message ?? 'Unknown error',
      statusCode: response.statusCode,
      details: response.metadata,
      errorType: response.statusCode != null
          ? NetworkErrorType.fromStatusCode(response.statusCode!)
          : null,
    );
  }

  bool get isRetryable => errorType?.isRetryable == true;

  @override
  String toString() {
    return 'ApiException: $message${statusCode != null ? ' (Status: $statusCode)' : ''}'
           '${requestId != null ? ' [Request: $requestId]' : ''}';
  }
}

/// Enhanced API Response with metadata and caching support
class EnhancedApiResponse<T> extends ApiResponse<T> {
  final Map<String, dynamic>? meta;
  final Map<String, dynamic>? pagination;
  final CacheInfo? cacheInfo;
  final String? requestId;
  final Duration? latency;
  final bool isFromCache;
  final bool isStale;

  const EnhancedApiResponse({
    required bool success,
    T? data,
    String? message,
    String? error,
    int? statusCode,
    Map<String, dynamic>? metadata,
    required DateTime timestamp,
    this.meta,
    this.pagination,
    this.cacheInfo,
    this.requestId,
    this.latency,
    this.isFromCache = false,
    this.isStale = false,
  }) : super(
          success: success,
          data: data,
          message: message,
          error: error,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
        );

  factory EnhancedApiResponse.fromApiResponse(
    ApiResponse<T> response, {
    Map<String, dynamic>? meta,
    Map<String, dynamic>? pagination,
    CacheInfo? cacheInfo,
    String? requestId,
    Duration? latency,
    bool isFromCache = false,
    bool isStale = false,
  }) {
    return EnhancedApiResponse<T>(
      success: response.success,
      data: response.data,
      message: response.message,
      error: response.error,
      statusCode: response.statusCode,
      metadata: response.metadata,
      timestamp: response.timestamp,
      meta: meta,
      pagination: pagination,
      cacheInfo: cacheInfo,
      requestId: requestId,
      latency: latency,
      isFromCache: isFromCache,
      isStale: isStale,
    );
  }

  factory EnhancedApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromJsonT,
  ) {
    return EnhancedApiResponse<T>(
      success: json['success'] as bool? ?? false,
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'])
          : json['data'] as T?,
      message: json['message'] as String?,
      error: json['error'] as String?,
      statusCode: json['statusCode'] as int?,
      metadata: json['metadata'] as Map<String, dynamic>?,
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : DateTime.now(),
      meta: json['meta'] as Map<String, dynamic>?,
      pagination: json['pagination'] as Map<String, dynamic>?,
      cacheInfo: json['meta']?['cache_info'] != null
          ? CacheInfo.fromJson(json['meta']['cache_info'])
          : null,
      requestId: json['meta']?['request_id'] as String?,
      latency: json['latency'] != null
          ? Duration(milliseconds: json['latency'] as int)
          : null,
      isFromCache: json['isFromCache'] as bool? ?? false,
      isStale: json['isStale'] as bool? ?? false,
    );
  }

  EnhancedApiResponse<R> mapEnhanced<R>(R Function(T) transform) {
    if (success && data != null) {
      try {
        final transformedData = transform(data as T);
        return EnhancedApiResponse<R>(
          success: true,
          data: transformedData,
          message: message,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
          meta: meta,
          pagination: pagination,
          cacheInfo: cacheInfo,
          requestId: requestId,
          latency: latency,
          isFromCache: isFromCache,
          isStale: isStale,
        );
      } catch (e) {
        return EnhancedApiResponse<R>(
          success: false,
          error: 'Data transformation failed: $e',
          message: message,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
          meta: meta,
          pagination: pagination,
          cacheInfo: cacheInfo,
          requestId: requestId,
          latency: latency,
          isFromCache: isFromCache,
          isStale: isStale,
        );
      }
    } else {
      return EnhancedApiResponse<R>(
        success: false,
        error: error,
        message: message,
        statusCode: statusCode,
        metadata: metadata,
        timestamp: timestamp,
        meta: meta,
        pagination: pagination,
        cacheInfo: cacheInfo,
        requestId: requestId,
        latency: latency,
        isFromCache: isFromCache,
        isStale: isStale,
      );
    }
  }

  @override
  EnhancedApiResponse<T> copyWith({
    bool? success,
    T? data,
    String? message,
    String? error,
    int? statusCode,
    Map<String, dynamic>? metadata,
    DateTime? timestamp,
    Map<String, dynamic>? meta,
    Map<String, dynamic>? pagination,
    CacheInfo? cacheInfo,
    String? requestId,
    Duration? latency,
    bool? isFromCache,
    bool? isStale,
  }) {
    return EnhancedApiResponse<T>(
      success: success ?? this.success,
      data: data ?? this.data,
      message: message ?? this.message,
      error: error ?? this.error,
      statusCode: statusCode ?? this.statusCode,
      metadata: metadata ?? this.metadata,
      timestamp: timestamp ?? this.timestamp,
      meta: meta ?? this.meta,
      pagination: pagination ?? this.pagination,
      cacheInfo: cacheInfo ?? this.cacheInfo,
      requestId: requestId ?? this.requestId,
      latency: latency ?? this.latency,
      isFromCache: isFromCache ?? this.isFromCache,
      isStale: isStale ?? this.isStale,
    );
  }

  @override
  Map<String, dynamic> toJson([dynamic Function(T)? toJsonT]) {
    final baseJson = super.toJson(toJsonT);
    if (meta != null) baseJson['meta'] = meta;
    if (pagination != null) baseJson['pagination'] = pagination;
    if (latency != null) baseJson['latency'] = latency!.inMilliseconds;
    baseJson['isFromCache'] = isFromCache;
    baseJson['isStale'] = isStale;
    return baseJson;
  }

  bool get hasMetadata => meta != null && meta!.isNotEmpty;
  bool get isPaginated => pagination != null;
  bool get isCacheable => cacheInfo?.cacheable == true;
  bool get isExpired => cacheInfo?.isExpired == true;

  @override
  String toString() {
    return 'EnhancedApiResponse(success: $success, data: $data, message: $message, '
           'error: $error, statusCode: $statusCode, isFromCache: $isFromCache, '
           'isStale: $isStale, latency: ${latency?.inMilliseconds}ms)';
  }
}

/// Cache information for API responses
class CacheInfo {
  final bool cacheable;
  final int? ttl;
  final String? etag;
  final DateTime? expiresAt;
  final List<String> tags;
  final String? version;

  const CacheInfo({
    required this.cacheable,
    this.ttl,
    this.etag,
    this.expiresAt,
    this.tags = const [],
    this.version,
  });

  factory CacheInfo.fromJson(Map<String, dynamic> json) {
    return CacheInfo(
      cacheable: json['cacheable'] as bool? ?? false,
      ttl: json['ttl'] as int?,
      etag: json['etag'] as String?,
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : null,
      tags: (json['tags'] as List<dynamic>?)?.cast<String>() ?? [],
      version: json['version'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'cacheable': cacheable,
      if (ttl != null) 'ttl': ttl,
      if (etag != null) 'etag': etag,
      if (expiresAt != null) 'expires_at': expiresAt!.toIso8601String(),
      if (tags.isNotEmpty) 'tags': tags,
      if (version != null) 'version': version,
    };
  }

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  Duration? get timeToExpiry {
    if (expiresAt == null) return null;
    final now = DateTime.now();
    if (now.isAfter(expiresAt!)) return Duration.zero;
    return expiresAt!.difference(now);
  }

  CacheInfo copyWith({
    bool? cacheable,
    int? ttl,
    String? etag,
    DateTime? expiresAt,
    List<String>? tags,
    String? version,
  }) {
    return CacheInfo(
      cacheable: cacheable ?? this.cacheable,
      ttl: ttl ?? this.ttl,
      etag: etag ?? this.etag,
      expiresAt: expiresAt ?? this.expiresAt,
      tags: tags ?? this.tags,
      version: version ?? this.version,
    );
  }
}

/// Network Response - specialized for network operations
class NetworkResponse<T> extends EnhancedApiResponse<T> {
  final Map<String, String>? headers;
  final String? endpoint;
  final String? method;
  final int? retryCount;
  final NetworkErrorType? errorType;

  const NetworkResponse({
    required bool success,
    T? data,
    String? message,
    String? error,
    int? statusCode,
    Map<String, dynamic>? metadata,
    required DateTime timestamp,
    Map<String, dynamic>? meta,
    Map<String, dynamic>? pagination,
    CacheInfo? cacheInfo,
    String? requestId,
    Duration? latency,
    bool isFromCache = false,
    bool isStale = false,
    this.headers,
    this.endpoint,
    this.method,
    this.retryCount,
    this.errorType,
  }) : super(
          success: success,
          data: data,
          message: message,
          error: error,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
          meta: meta,
          pagination: pagination,
          cacheInfo: cacheInfo,
          requestId: requestId,
          latency: latency,
          isFromCache: isFromCache,
          isStale: isStale,
        );

  factory NetworkResponse.fromEnhanced(
    EnhancedApiResponse<T> response, {
    Map<String, String>? headers,
    String? endpoint,
    String? method,
    int? retryCount,
    NetworkErrorType? errorType,
  }) {
    return NetworkResponse<T>(
      success: response.success,
      data: response.data,
      message: response.message,
      error: response.error,
      statusCode: response.statusCode,
      metadata: response.metadata,
      timestamp: response.timestamp,
      meta: response.meta,
      pagination: response.pagination,
      cacheInfo: response.cacheInfo,
      requestId: response.requestId,
      latency: response.latency,
      isFromCache: response.isFromCache,
      isStale: response.isStale,
      headers: headers,
      endpoint: endpoint,
      method: method,
      retryCount: retryCount,
      errorType: errorType,
    );
  }

  bool get wasRetried => retryCount != null && retryCount! > 0;
  bool get hasNetworkError => errorType != null;

  @override
  String toString() {
    return 'NetworkResponse(success: $success, endpoint: $endpoint, method: $method, '
           'statusCode: $statusCode, latency: ${latency?.inMilliseconds}ms, '
           'isFromCache: $isFromCache, retries: $retryCount)';
  }
}

/// Network error types
enum NetworkErrorType {
  connectionTimeout,
  readTimeout,
  writeTimeout,
  connectionError,
  serverError,
  clientError,
  parseError,
  authenticationError,
  authorizationError,
  notFound,
  rateLimited,
  serviceUnavailable,
  unknown;

  bool get isRetryable {
    switch (this) {
      case NetworkErrorType.connectionTimeout:
      case NetworkErrorType.readTimeout:
      case NetworkErrorType.connectionError:
      case NetworkErrorType.serverError:
      case NetworkErrorType.serviceUnavailable:
        return true;
      default:
        return false;
    }
  }

  static NetworkErrorType fromStatusCode(int statusCode) {
    switch (statusCode) {
      case 401:
        return NetworkErrorType.authenticationError;
      case 403:
        return NetworkErrorType.authorizationError;
      case 404:
        return NetworkErrorType.notFound;
      case 429:
        return NetworkErrorType.rateLimited;
      case 503:
        return NetworkErrorType.serviceUnavailable;
      case >= 400 && < 500:
        return NetworkErrorType.clientError;
      case >= 500:
        return NetworkErrorType.serverError;
      default:
        return NetworkErrorType.unknown;
    }
  }
}

/// Pagination information helper class
class PaginationInfo {
  final int currentPage;
  final int totalPages;
  final int totalItems;
  final int itemsPerPage;
  final bool hasNextPage;
  final bool hasPreviousPage;

  const PaginationInfo({
    required this.currentPage,
    required this.totalPages,
    required this.totalItems,
    required this.itemsPerPage,
    required this.hasNextPage,
    required this.hasPreviousPage,
  });

  factory PaginationInfo.fromJson(Map<String, dynamic> json) {
    final currentPage = json['currentPage'] as int? ?? 1;
    final totalPages = json['totalPages'] as int? ?? 1;

    return PaginationInfo(
      currentPage: currentPage,
      totalPages: totalPages,
      totalItems: json['totalItems'] as int? ?? 0,
      itemsPerPage: json['itemsPerPage'] as int? ?? 10,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'currentPage': currentPage,
      'totalPages': totalPages,
      'totalItems': totalItems,
      'itemsPerPage': itemsPerPage,
      'hasNextPage': hasNextPage,
      'hasPreviousPage': hasPreviousPage,
    };
  }

  bool get isFirstPage => currentPage == 1;
  bool get isLastPage => currentPage == totalPages;
  double get progress => totalPages > 0 ? currentPage / totalPages : 0.0;

  @override
  String toString() {
    return 'PaginationInfo(page: $currentPage/$totalPages, items: $totalItems, perPage: $itemsPerPage)';
  }
}
