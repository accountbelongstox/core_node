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
  const StorageConfigurationException(super.message, {super.code, super.details});
}

/// Initialization exception
class StorageInitializationException extends StorageException {
  const StorageInitializationException(super.message, {super.code, super.details});
}

/// Data validation exception
class StorageValidationException extends StorageException {
  const StorageValidationException(super.message, {super.code, super.details});
}

/// Encryption exception
class StorageEncryptionException extends StorageException {
  const StorageEncryptionException(super.message, {super.code, super.details});
}

/// Cache exception
class StorageCacheException extends StorageException {
  const StorageCacheException(super.message, {super.code, super.details});
}

/// Transaction exception
class StorageTransactionException extends StorageException {
  const StorageTransactionException(super.message, {super.code, super.details});
}

/// Migration exception
class StorageMigrationException extends StorageException {
  const StorageMigrationException(super.message, {super.code, super.details});
}