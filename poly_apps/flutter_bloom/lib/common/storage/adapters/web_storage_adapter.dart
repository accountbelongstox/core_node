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

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'dart:html' as html;
import '../interfaces/storage_interface.dart';
import '../models/storage_models.dart';

/// Web-compatible storage adapter using localStorage
/// Provides the same interface as other storage adapters but uses browser localStorage
class WebStorageAdapter implements KeyValueStorageInterface {
  static WebStorageAdapter? _instance;
  static WebStorageAdapter get instance => 
      _instance ??= WebStorageAdapter._internal();

  WebStorageAdapter._internal();

  final Map<String, StreamController<StorageChange>> _changeControllers = {};
  String? _appName;
  String? _subDirectory;
  bool _isInitialized = false;

  @override
  Future<void> init({String? appName, String? subDirectory}) async {
    if (_isInitialized) return;

    _appName = appName ?? 'flutter_bloom';
    _subDirectory = subDirectory ?? 'storage_web';

    if (!kIsWeb) {
      throw UnsupportedError('WebStorageAdapter can only be used on web platform');
    }

    _isInitialized = true;
    debugPrint('WebStorageAdapter initialized successfully for $_appName');
  }

  @override
  Future<void> openBox(String boxName) async {
    _ensureInitialized();
    if (!_changeControllers.containsKey(boxName)) {
      _changeControllers[boxName] = StreamController<StorageChange>.broadcast();
    }
  }

  @override
  bool isBoxOpen(String boxName) {
    return _changeControllers.containsKey(boxName);
  }

  @override
  Future<void> closeBox(String boxName) async {
    _changeControllers[boxName]?.close();
    _changeControllers.remove(boxName);
  }

  @override
  Future<void> deleteBox(String boxName) async {
    _ensureInitialized();
    
    // Get all keys for this box
    final keys = await getKeys(boxName);
    for (final key in keys) {
      await deleteKey(boxName, key.toString());
    }
    
    await closeBox(boxName);
  }

  @override
  Future<void> clearBox(String boxName) async {
    _ensureInitialized();
    
    // Get all keys for this box
    final keys = await getKeys(boxName);
    for (final key in keys) {
      await deleteKey(boxName, key.toString());
    }
  }

  @override
  Future<T?> getValue<T>(String boxName, String key, {T? defaultValue}) async {
    _ensureInitialized();
    
    try {
      final storageKey = _getStorageKey(boxName, key);
      final value = _getFromLocalStorage(storageKey);
      
      if (value == null) {
        return defaultValue;
      }

      return _deserializeValue<T>(value);
    } catch (e) {
      debugPrint('WebStorageAdapter getValue error: $e');
      return defaultValue;
    }
  }

  @override
  Future<void> putValue<T>(String boxName, String key, T value) async {
    _ensureInitialized();
    
    try {
      final storageKey = _getStorageKey(boxName, key);
      final serialized = _serializeValue<T>(value);
      
      _setToLocalStorage(storageKey, serialized);
      
      // Notify listeners
      _notifyChange(boxName, key, value, StorageChangeType.updated);
    } catch (e) {
      debugPrint('WebStorageAdapter putValue error: $e');
      rethrow;
    }
  }

  @override
  Future<void> deleteKey(String boxName, String key) async {
    _ensureInitialized();
    
    try {
      final storageKey = _getStorageKey(boxName, key);
      _removeFromLocalStorage(storageKey);
      
      // Notify listeners
      _notifyChange(boxName, key, null, StorageChangeType.deleted);
    } catch (e) {
      debugPrint('WebStorageAdapter deleteKey error: $e');
      rethrow;
    }
  }

  @override
  Future<bool> containsKey(String boxName, String key) async {
    _ensureInitialized();
    
    try {
      final storageKey = _getStorageKey(boxName, key);
      return _getFromLocalStorage(storageKey) != null;
    } catch (e) {
      debugPrint('WebStorageAdapter containsKey error: $e');
      return false;
    }
  }

  @override
  Future<Iterable<dynamic>> getKeys(String boxName) async {
    _ensureInitialized();
    
    try {
      final prefix = _getBoxPrefix(boxName);
      final keys = <String>[];
      
      // Get all localStorage keys
      for (int i = 0; i < _getLocalStorageLength(); i++) {
        final key = _getLocalStorageKey(i);
        if (key != null && key.startsWith(prefix)) {
          // Extract the actual key from the storage key
          final actualKey = key.substring(prefix.length);
          keys.add(actualKey);
        }
      }
      
      return keys;
    } catch (e) {
      debugPrint('WebStorageAdapter getKeys error: $e');
      return [];
    }
  }

  @override
  Future<Map<String, dynamic>> getAllFromBox(String boxName) async {
    _ensureInitialized();
    
    try {
      final prefix = _getBoxPrefix(boxName);
      final Map<String, dynamic> data = {};
      
      // Get all localStorage keys for this box
      for (int i = 0; i < _getLocalStorageLength(); i++) {
        final key = _getLocalStorageKey(i);
        if (key != null && key.startsWith(prefix)) {
          final actualKey = key.substring(prefix.length);
          final value = _getFromLocalStorage(key);
          if (value != null) {
            data[actualKey] = _deserializeValue<dynamic>(value);
          }
        }
      }
      
      return data;
    } catch (e) {
      debugPrint('WebStorageAdapter getAllFromBox error: $e');
      return {};
    }
  }

  @override
  Stream<StorageChange> watchBox(String boxName, {String? key}) {
    if (!_changeControllers.containsKey(boxName)) {
      _changeControllers[boxName] = StreamController<StorageChange>.broadcast();
    }

    final controller = _changeControllers[boxName]!;
    
    if (key != null) {
      return controller.stream.where((change) => change.key == key);
    }
    
    return controller.stream;
  }

  /// Set value with expiration (Web localStorage doesn't support TTL, so we simulate it)
  Future<void> putValueWithExpiry<T>(
    String boxName, 
    String key, 
    T value, 
    Duration expiry,
  ) async {
    _ensureInitialized();
    
    try {
      final expiryTime = DateTime.now().add(expiry).millisecondsSinceEpoch;
      final data = {
        'value': _serializeValue<T>(value),
        'expiry': expiryTime,
      };
      
      final storageKey = _getStorageKey(boxName, key);
      _setToLocalStorage(storageKey, jsonEncode(data));
      
      // Notify listeners
      _notifyChange(boxName, key, value, StorageChangeType.updated);
    } catch (e) {
      debugPrint('WebStorageAdapter putValueWithExpiry error: $e');
      rethrow;
    }
  }

  /// Clean up expired entries
  Future<int> cleanupExpiredEntries() async {
    _ensureInitialized();
    
    try {
      int cleanedCount = 0;
      
      // Check all localStorage entries for expiry
      for (int i = 0; i < _getLocalStorageLength(); i++) {
        final key = _getLocalStorageKey(i);
        if (key != null) {
          final value = _getFromLocalStorage(key);
          if (value != null) {
            try {
              final data = jsonDecode(value);
              if (data is Map && data.containsKey('expiry')) {
                final expiry = data['expiry'] as int;
                if (DateTime.now().millisecondsSinceEpoch > expiry) {
                  _removeFromLocalStorage(key);
                  cleanedCount++;
                }
              }
            } catch (e) {
              // Not an expiry entry, ignore
            }
          }
        }
      }
      
      debugPrint('Cleaned up $cleanedCount expired entries from localStorage');
      return cleanedCount;
    } catch (e) {
      debugPrint('WebStorageAdapter cleanupExpiredEntries error: $e');
      return 0;
    }
  }

  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    _ensureInitialized();
    
    try {
      final totalEntries = _getLocalStorageLength();
      final Map<String, int> boxStats = {};
      
      // Count entries per box
      for (int i = 0; i < totalEntries; i++) {
        final key = _getLocalStorageKey(i);
        if (key != null) {
          final boxName = _extractBoxName(key);
          if (boxName != null) {
            boxStats[boxName] = (boxStats[boxName] ?? 0) + 1;
          }
        }
      }

      return {
        'total_entries': totalEntries,
        'box_stats': boxStats,
        'storage_type': 'localStorage',
      };
    } catch (e) {
      debugPrint('WebStorageAdapter getStorageStats error: $e');
      return {};
    }
  }

  /// Dispose resources
  Future<void> dispose() async {
    for (final controller in _changeControllers.values) {
      await controller.close();
    }
    _changeControllers.clear();
    _isInitialized = false;
  }

  void _ensureInitialized() {
    if (!_isInitialized) {
      throw StateError('WebStorageAdapter not initialized. Call init() first.');
    }
  }

  void _notifyChange(String boxName, String key, dynamic value, StorageChangeType type) {
    final controller = _changeControllers[boxName];
    if (controller != null && !controller.isClosed) {
      controller.add(StorageChange(
        key: key,
        oldValue: null, // We don't track old values for simplicity
        newValue: value,
        type: type,
        timestamp: DateTime.now(),
      ));
    }
  }

  String _getStorageKey(String boxName, String key) {
    return '${_appName}_${_subDirectory}_${boxName}_$key';
  }

  String _getBoxPrefix(String boxName) {
    return '${_appName}_${_subDirectory}_${boxName}_';
  }

  String? _extractBoxName(String storageKey) {
    final parts = storageKey.split('_');
    if (parts.length >= 4) {
      return parts[parts.length - 2]; // Second to last part is box name
    }
    return null;
  }

  /// Serialize value to string
  String _serializeValue<T>(T value) {
    if (value == null) {
      return '';
    }
    
    if (value is String) {
      return value;
    } else if (value is int || value is double || value is bool) {
      return value.toString();
    } else {
      // For complex objects, serialize to JSON
      return jsonEncode(value);
    }
  }

  /// Deserialize value from string
  T? _deserializeValue<T>(String? value) {
    if (value == null || value.isEmpty) {
      return null;
    }

    try {
      // Try to parse as JSON first
      final decoded = jsonDecode(value);
      return decoded as T;
    } catch (e) {
      // If not JSON, return as string
      return value as T;
    }
  }

  // Web-specific localStorage methods using dart:js
  String? _getFromLocalStorage(String key) {
    try {
      // Use dart:js to access localStorage
      // This is a simplified implementation that works on web
      return _jsGetLocalStorage(key);
    } catch (e) {
      debugPrint('Failed to get from localStorage: $e');
      return null;
    }
  }

  void _setToLocalStorage(String key, String value) {
    try {
      _jsSetLocalStorage(key, value);
    } catch (e) {
      debugPrint('Failed to set localStorage: $e');
    }
  }

  void _removeFromLocalStorage(String key) {
    try {
      _jsRemoveLocalStorage(key);
    } catch (e) {
      debugPrint('Failed to remove from localStorage: $e');
    }
  }

  int _getLocalStorageLength() {
    try {
      return _jsGetLocalStorageLength();
    } catch (e) {
      debugPrint('Failed to get localStorage length: $e');
      return 0;
    }
  }

  String? _getLocalStorageKey(int index) {
    try {
      return _jsGetLocalStorageKey(index);
    } catch (e) {
      debugPrint('Failed to get localStorage key: $e');
      return null;
    }
  }

  // JavaScript interop methods using dart:html
  String? _jsGetLocalStorage(String key) {
    if (!kIsWeb) return null;
    try {
      return html.window.localStorage[key];
    } catch (e) {
      debugPrint('Failed to get from localStorage: $e');
      return null;
    }
  }

  void _jsSetLocalStorage(String key, String value) {
    if (!kIsWeb) return;
    try {
      html.window.localStorage[key] = value;
    } catch (e) {
      debugPrint('Failed to set localStorage: $e');
    }
  }

  void _jsRemoveLocalStorage(String key) {
    if (!kIsWeb) return;
    try {
      html.window.localStorage.remove(key);
    } catch (e) {
      debugPrint('Failed to remove from localStorage: $e');
    }
  }

  int _jsGetLocalStorageLength() {
    if (!kIsWeb) return 0;
    try {
      return html.window.localStorage.length;
    } catch (e) {
      debugPrint('Failed to get localStorage length: $e');
      return 0;
    }
  }

  String? _jsGetLocalStorageKey(int index) {
    if (!kIsWeb) return null;
    try {
      if (index >= 0 && index < html.window.localStorage.length) {
        return html.window.localStorage.keys.elementAt(index);
      }
      return null;
    } catch (e) {
      debugPrint('Failed to get localStorage key: $e');
      return null;
    }
  }
}
