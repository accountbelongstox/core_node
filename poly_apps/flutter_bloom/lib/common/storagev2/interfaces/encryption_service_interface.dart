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

import '../models/storage_result.dart';

/// Encryption service interface for data encryption/decryption
abstract class EncryptionService {
  /// Initialize the encryption service
  Future<StorageResult<void>> initialize(String? key);
  
  /// Encrypt data
  Future<StorageResult<String>> encrypt(String data);
  
  /// Decrypt data
  Future<StorageResult<String>> decrypt(String encryptedData);
  
  /// Encrypt bytes
  Future<StorageResult<List<int>>> encryptBytes(List<int> data);
  
  /// Decrypt bytes
  Future<StorageResult<List<int>>> decryptBytes(List<int> encryptedData);
  
  /// Generate a new encryption key
  Future<StorageResult<String>> generateKey();
  
  /// Check if data is encrypted
  bool isEncrypted(String data);
  
  /// Get encryption algorithm info
  EncryptionInfo getEncryptionInfo();
  
  /// Close the encryption service
  Future<StorageResult<void>> close();
}

/// Encryption information
class EncryptionInfo {
  final String algorithm;
  final int keySize;
  final String mode;
  final String padding;
  final bool isSecure;
  
  const EncryptionInfo({
    required this.algorithm,
    required this.keySize,
    required this.mode,
    required this.padding,
    required this.isSecure,
  });
  
  @override
  String toString() => 'EncryptionInfo($algorithm-$keySize-$mode-$padding)';
}
