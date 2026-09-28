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
