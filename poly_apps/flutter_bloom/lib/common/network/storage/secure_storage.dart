import 'dart:convert';
import 'package:flutter/foundation.dart';

/// Secure storage manager for sensitive data
/// Note: In production, use flutter_secure_storage for better security
class SecureStorage {
  static SecureStorage? _instance;
  static SecureStorage get instance => _instance ??= SecureStorage._();
  SecureStorage._();

  final Map<String, String> _memoryStorage = {};
  final String _prefix = 'secure_';

  /// Initialize secure storage
  Future<void> initialize() async {
    // Using memory storage for now - in production use flutter_secure_storage
  }

  /// Write data to secure storage
  Future<void> write(String key, String value) async {
    await initialize();
    final encryptedValue = _encrypt(value);
    _memoryStorage['$_prefix$key'] = encryptedValue;
  }

  /// Read data from secure storage
  Future<String?> read(String key) async {
    await initialize();
    final encryptedValue = _memoryStorage['$_prefix$key'];
    if (encryptedValue == null) return null;
    return _decrypt(encryptedValue);
  }

  /// Delete data from secure storage
  Future<void> delete(String key) async {
    await initialize();
    _memoryStorage.remove('$_prefix$key');
  }

  /// Delete all data from secure storage
  Future<void> deleteAll() async {
    await initialize();
    final keys = _memoryStorage.keys.where((key) => key.startsWith(_prefix));
    for (final key in keys.toList()) {
      _memoryStorage.remove(key);
    }
  }

  /// Check if key exists
  Future<bool> containsKey(String key) async {
    await initialize();
    return _memoryStorage.containsKey('$_prefix$key');
  }

  /// Get all keys
  Future<Set<String>> getAllKeys() async {
    await initialize();
    return _memoryStorage.keys
        .where((key) => key.startsWith(_prefix))
        .map((key) => key.substring(_prefix.length))
        .toSet();
  }

  /// Write JSON data
  Future<void> writeJson(String key, Map<String, dynamic> value) async {
    await write(key, jsonEncode(value));
  }

  /// Read JSON data
  Future<Map<String, dynamic>?> readJson(String key) async {
    final value = await read(key);
    if (value == null) return null;
    try {
      return jsonDecode(value) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('Error decoding JSON for key $key: $e');
      return null;
    }
  }

  /// Write list data
  Future<void> writeList(String key, List<String> value) async {
    await write(key, jsonEncode(value));
  }

  /// Read list data
  Future<List<String>?> readList(String key) async {
    final value = await read(key);
    if (value == null) return null;
    try {
      final decoded = jsonDecode(value) as List;
      return decoded.map((e) => e.toString()).toList();
    } catch (e) {
      debugPrint('Error decoding list for key $key: $e');
      return null;
    }
  }

  /// Write boolean data
  Future<void> writeBool(String key, bool value) async {
    await write(key, value.toString());
  }

  /// Read boolean data
  Future<bool?> readBool(String key) async {
    final value = await read(key);
    if (value == null) return null;
    return value.toLowerCase() == 'true';
  }

  /// Write integer data
  Future<void> writeInt(String key, int value) async {
    await write(key, value.toString());
  }

  /// Read integer data
  Future<int?> readInt(String key) async {
    final value = await read(key);
    if (value == null) return null;
    return int.tryParse(value);
  }

  /// Write double data
  Future<void> writeDouble(String key, double value) async {
    await write(key, value.toString());
  }

  /// Read double data
  Future<double?> readDouble(String key) async {
    final value = await read(key);
    if (value == null) return null;
    return double.tryParse(value);
  }

  /// Simple encryption (for demo purposes)
  /// In production, use proper encryption libraries
  String _encrypt(String value) {
    if (kDebugMode) {
      // In debug mode, don't encrypt for easier debugging
      return base64Encode(utf8.encode(value));
    }
    
    // Simple XOR encryption with a key
    const key = 'FlutterNetworkSecureKey2024';
    final keyBytes = utf8.encode(key);
    final valueBytes = utf8.encode(value);
    final encrypted = <int>[];
    
    for (int i = 0; i < valueBytes.length; i++) {
      encrypted.add(valueBytes[i] ^ keyBytes[i % keyBytes.length]);
    }
    
    return base64Encode(encrypted);
  }

  /// Simple decryption (for demo purposes)
  String _decrypt(String encryptedValue) {
    if (kDebugMode) {
      // In debug mode, just decode base64
      try {
        return utf8.decode(base64Decode(encryptedValue));
      } catch (e) {
        debugPrint('Error decoding value: $e');
        return encryptedValue;
      }
    }
    
    try {
      const key = 'FlutterNetworkSecureKey2024';
      final keyBytes = utf8.encode(key);
      final encryptedBytes = base64Decode(encryptedValue);
      final decrypted = <int>[];
      
      for (int i = 0; i < encryptedBytes.length; i++) {
        decrypted.add(encryptedBytes[i] ^ keyBytes[i % keyBytes.length]);
      }
      
      return utf8.decode(decrypted);
    } catch (e) {
      debugPrint('Error decrypting value: $e');
      return encryptedValue;
    }
  }

  /// Clear all storage (for testing/debugging)
  Future<void> clearAll() async {
    await initialize();
    _memoryStorage.clear();
  }

  /// Get storage size (approximate)
  Future<int> getStorageSize() async {
    await initialize();
    int totalSize = 0;
    final keys = _memoryStorage.keys.where((key) => key.startsWith(_prefix));

    for (final key in keys) {
      final value = _memoryStorage[key];
      if (value != null) {
        totalSize += key.length + value.length;
      }
    }

    return totalSize;
  }

  /// Export all data (for backup/migration)
  Future<Map<String, String>> exportAll() async {
    await initialize();
    final result = <String, String>{};
    final keys = await getAllKeys();
    
    for (final key in keys) {
      final value = await read(key);
      if (value != null) {
        result[key] = value;
      }
    }
    
    return result;
  }

  /// Import data (for backup/migration)
  Future<void> importAll(Map<String, String> data) async {
    for (final entry in data.entries) {
      await write(entry.key, entry.value);
    }
  }

  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    await initialize();
    final keys = await getAllKeys();
    final size = await getStorageSize();
    
    return {
      'totalKeys': keys.length,
      'totalSize': size,
      'keys': keys.toList(),
      'sizePerKey': keys.isEmpty ? 0 : size / keys.length,
    };
  }
}
