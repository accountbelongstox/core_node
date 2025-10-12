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

/// Base exception for storage operations
abstract class StorageException implements Exception {
  final String message;
  final String? code;
  final dynamic details;
  
  const StorageException(this.message, {this.code, this.details});
  
  @override
  String toString() => 'StorageException: $message';
}

/// Configuration exception
class StorageConfigurationException extends StorageException {
  const StorageConfigurationException(String message, {String? code, dynamic details})
      : super(message, code: code, details: details);
}

/// Initialization exception
class StorageInitializationException extends StorageException {
  const StorageInitializationException(String message, {String? code, dynamic details})
      : super(message, code: code, details: details);
}

/// Data validation exception
class StorageValidationException extends StorageException {
  const StorageValidationException(String message, {String? code, dynamic details})
      : super(message, code: code, details: details);
}

/// Encryption exception
class StorageEncryptionException extends StorageException {
  const StorageEncryptionException(String message, {String? code, dynamic details})
      : super(message, code: code, details: details);
}

/// Cache exception
class StorageCacheException extends StorageException {
  const StorageCacheException(String message, {String? code, dynamic details})
      : super(message, code: code, details: details);
}

/// Transaction exception
class StorageTransactionException extends StorageException {
  const StorageTransactionException(String message, {String? code, dynamic details})
      : super(message, code: code, details: details);
}

/// Migration exception
class StorageMigrationException extends StorageException {
  const StorageMigrationException(String message, {String? code, dynamic details})
      : super(message, code: code, details: details);
}