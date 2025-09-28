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

import 'api_response.dart';

/// Enhanced API Response with metadata and caching support for AChat integration
class EnhancedApiResponse<T> extends ApiResponse<T> {
  final Map<String, dynamic>? meta;
  final Map<String, dynamic>? pagination;
  final CacheInfo? cacheInfo;
  final String? requestId;

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
  }) : super(
          success: success,
          data: data,
          message: message,
          error: error,
          statusCode: statusCode,
          metadata: metadata,
          timestamp: timestamp,
        );

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
      );
    }
  }

  @override
  Map<String, dynamic> toJson([dynamic Function(T)? toJsonT]) {
    final baseJson = super.toJson(toJsonT);
    if (meta != null) baseJson['meta'] = meta;
    if (pagination != null) baseJson['pagination'] = pagination;
    return baseJson;
  }
}

/// Cache information for API responses
class CacheInfo {
  final bool cacheable;
  final int? ttl;
  final String? etag;
  final DateTime? expiresAt;

  const CacheInfo({
    required this.cacheable,
    this.ttl,
    this.etag,
    this.expiresAt,
  });

  factory CacheInfo.fromJson(Map<String, dynamic> json) {
    return CacheInfo(
      cacheable: json['cacheable'] as bool? ?? false,
      ttl: json['ttl'] as int?,
      etag: json['etag'] as String?,
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'cacheable': cacheable,
      if (ttl != null) 'ttl': ttl,
      if (etag != null) 'etag': etag,
      if (expiresAt != null) 'expires_at': expiresAt!.toIso8601String(),
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
}