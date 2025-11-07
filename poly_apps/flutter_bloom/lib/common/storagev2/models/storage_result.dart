// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Storage operation result types using Either pattern for functional error handling
sealed class StorageResult<T> {
  const StorageResult();
  
  /// Check if result is success
  bool get isSuccess => this is StorageSuccess<T>;
  
  /// Check if result is error
  bool get isError => this is StorageError;
  
  /// Get success data or null
  T? get data => isSuccess ? (this as StorageSuccess<T>).data : null;
  
  /// Get error or null
  StorageError? get error => isError ? (this as StorageError) : null;
  
  /// Fold result to single value
  R fold<R>(R Function(StorageError) onError, R Function(T) onSuccess) {
    return switch (this) {
      StorageSuccess<T>(data: final data) => onSuccess(data),
      StorageError() => onError(this as StorageError),
    };
  }
  
  /// Map success value
  StorageResult<R> map<R>(R Function(T) mapper) {
    return switch (this) {
      StorageSuccess<T>(data: final data) => StorageSuccess(mapper(data)),
      StorageError() => this as StorageResult<R>,
    };
  }
  
  /// Flat map result
  StorageResult<R> flatMap<R>(StorageResult<R> Function(T) mapper) {
    return switch (this) {
      StorageSuccess<T>(data: final data) => mapper(data),
      StorageError() => this as StorageResult<R>,
    };
  }
}

/// Success result containing data
class StorageSuccess<T> extends StorageResult<T> {
  @override
  final T data;
  const StorageSuccess(this.data);
  
  @override
  String toString() => 'StorageSuccess(data: $data)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StorageSuccess<T> && other.data == data);
  
  @override
  int get hashCode => data.hashCode;
}

/// Error result containing error information
class StorageError extends StorageResult<Never> {
  final String message;
  final String? code;
  final Exception? exception;
  final Map<String, dynamic>? metadata;
  final DateTime timestamp;
  
  StorageError({
    required this.message,
    this.code,
    this.exception,
    this.metadata,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
  
  /// Create error from exception
  factory StorageError.fromException(Exception exception, {String? message}) {
    return StorageError(
      message: message ?? exception.toString(),
      exception: exception,
      code: exception.runtimeType.toString(),
    );
  }
  
  /// Create error with code
  factory StorageError.withCode(String code, String message, {Map<String, dynamic>? metadata}) {
    return StorageError(
      code: code,
      message: message,
      metadata: metadata,
    );
  }
  
  /// Create error from another StorageResult
  factory StorageError.fromResult(StorageResult<dynamic> result) {
    if (result is StorageError) {
      return result;
    }
    return StorageError(
      message: 'Unknown error from result',
      code: 'UNKNOWN_ERROR',
    );
  }
  
  @override
  String toString() => 'StorageError(code: $code, message: $message, timestamp: $timestamp)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StorageError &&
          other.message == message &&
          other.code == code);
  
  @override
  int get hashCode => Object.hash(message, code);
}

/// Storage change event for reactive updates
class StorageChange<T> {
  final String id;
  final T? oldValue;
  final T? newValue;
  final StorageChangeType type;
  final DateTime timestamp;
  final Map<String, dynamic>? metadata;
  
  StorageChange({
    required this.id,
    this.oldValue,
    this.newValue,
    required this.type,
    DateTime? timestamp,
    this.metadata,
  }) : timestamp = timestamp ?? DateTime.now();
  
  /// Create change event for creation
  factory StorageChange.created(String id, T newValue, {Map<String, dynamic>? metadata}) {
    return StorageChange(
      id: id,
      newValue: newValue,
      type: StorageChangeType.created,
      metadata: metadata,
    );
  }
  
  /// Create change event for update
  factory StorageChange.updated(String id, T oldValue, T newValue, {Map<String, dynamic>? metadata}) {
    return StorageChange(
      id: id,
      oldValue: oldValue,
      newValue: newValue,
      type: StorageChangeType.updated,
      metadata: metadata,
    );
  }
  
  /// Create change event for deletion
  factory StorageChange.deleted(String id, T oldValue, {Map<String, dynamic>? metadata}) {
    return StorageChange(
      id: id,
      oldValue: oldValue,
      type: StorageChangeType.deleted,
      metadata: metadata,
    );
  }
  
  @override
  String toString() => 'StorageChange(id: $id, type: $type, timestamp: $timestamp)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StorageChange<T> &&
          other.id == id &&
          other.type == type &&
          other.timestamp == timestamp);
  
  @override
  int get hashCode => Object.hash(id, type, timestamp);
}

/// Types of storage changes
enum StorageChangeType {
  created,
  updated,
  deleted,
}