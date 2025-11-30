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

import '../interfaces/encryption_service_interface.dart';
import '../models/storage_result.dart';

/// Encryption adapter for data protection
class EncryptionAdapter {
  final EncryptionService _encryptionService;
  bool _isInitialized = false;
  
  EncryptionAdapter({required EncryptionService encryptionService})
      : _encryptionService = encryptionService;
  
  /// Initialize encryption adapter
  Future<StorageResult<void>> initialize(String? key) async {
    try {
      final result = await _encryptionService.initialize(key);
      if (result is StorageError) {
        return result;
      }
      
      _isInitialized = true;
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize encryption adapter',
      );
    }
  }
  
  /// Encrypt data before storage
  Future<StorageResult<String>> encryptData(String data) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Encryption adapter not initialized',
        );
      }
      
      return await _encryptionService.encrypt(data);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to encrypt data',
      );
    }
  }
  
  /// Decrypt data after retrieval
  Future<StorageResult<String>> decryptData(String encryptedData) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Encryption adapter not initialized',
        );
      }
      
      return await _encryptionService.decrypt(encryptedData);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to decrypt data',
      );
    }
  }
  
  /// Encrypt binary data
  Future<StorageResult<List<int>>> encryptBytes(List<int> data) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Encryption adapter not initialized',
        );
      }
      
      return await _encryptionService.encryptBytes(data);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to encrypt bytes',
      );
    }
  }
  
  /// Decrypt binary data
  Future<StorageResult<List<int>>> decryptBytes(List<int> encryptedData) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Encryption adapter not initialized',
        );
      }
      
      return await _encryptionService.decryptBytes(encryptedData);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to decrypt bytes',
      );
    }
  }
  
  /// Generate encryption key
  Future<StorageResult<String>> generateKey() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Encryption adapter not initialized',
        );
      }
      
      return await _encryptionService.generateKey();
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to generate encryption key',
      );
    }
  }
  
  /// Check if data is encrypted
  bool isEncrypted(String data) {
    return _encryptionService.isEncrypted(data);
  }
  
  /// Get encryption information
  EncryptionInfo getEncryptionInfo() {
    return _encryptionService.getEncryptionInfo();
  }
  
  /// Close encryption adapter
  Future<StorageResult<void>> close() async {
    try {
      final result = await _encryptionService.close();
      if (result is StorageError) {
        return result;
      }
      
      _isInitialized = false;
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close encryption adapter',
      );
    }
  }
  
  /// Check if adapter is initialized
  bool get isInitialized => _isInitialized;
}
