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

  const ApiException({
    required this.message,
    this.statusCode,
    this.details,
  });

  @override
  String toString() {
    return 'ApiException: $message${statusCode != null ? ' (Status: $statusCode)' : ''}';
  }
}
