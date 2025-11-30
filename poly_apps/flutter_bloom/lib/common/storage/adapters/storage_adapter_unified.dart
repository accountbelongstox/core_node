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
import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import '../interfaces/storage_interface.dart';
import '../models/storage_models.dart';

/// Unified SQLite storage adapter that bridges v1 and v2 storage systems
/// Provides compatibility between KeyValueStorageInterface and StorageAdapter patterns
class UnifiedSQLiteStorageAdapter implements KeyValueStorageInterface {
  static UnifiedSQLiteStorageAdapter? _instance;
  static UnifiedSQLiteStorageAdapter get instance => 
      _instance ??= UnifiedSQLiteStorageAdapter._internal();

  UnifiedSQLiteStorageAdapter._internal();

  Database? _database;
  final Map<String, StreamController<StorageChange>> _changeControllers = {};
  String? _appName;
  String? _subDirectory;
  bool _isInitialized = false;

  @override
  Future<void> init({String? appName, String? subDirectory}) async {
    if (_isInitialized) return;

    if (kIsWeb) {
      throw UnsupportedError(
        'UnifiedSQLiteStorageAdapter cannot be used on web platform. '
        'Use WebStorageAdapter instead.',
      );
    }

    _appName = appName ?? 'flutter_bloom';
    _subDirectory = subDirectory ?? 'storage_unified';

    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      final dbPath = join(
        documentsDirectory.path,
        _subDirectory!,
        '${_appName}_unified.db',
      );

      // Ensure directory exists
      final dbDir = join(documentsDirectory.path, _subDirectory!);
      await Directory(dbDir).create(recursive: true);

      _database = await openDatabase(
        dbPath,
        version: 2, // Increment version for unified storage
        onCreate: (db, version) async {
          await _createTables(db);
        },
        onUpgrade: (db, oldVersion, newVersion) async {
          if (oldVersion < 2) {
            await _createTables(db);
          }
        },
      );

      _isInitialized = true;
      debugPrint('UnifiedSQLiteStorageAdapter initialized successfully: $dbPath');
    } catch (e) {
      // Handle MissingPluginException gracefully
      if (e.toString().contains('MissingPluginException') || 
          e.toString().contains('getApplicationDocumentsDirectory')) {
        debugPrint('UnifiedSQLiteStorageAdapter: path_provider plugin not available. '
            'This is expected on web platform or when plugin is not properly initialized. '
            'Storage will use fallback mechanism.');
        // Don't rethrow on web or when plugin is missing - let the app continue
        if (kIsWeb) {
          _isInitialized = false;
          return;
        }
      }
      debugPrint('UnifiedSQLiteStorageAdapter initialization failed: $e');
      rethrow;
    }
  }

  /// Create database tables for unified storage
  Future<void> _createTables(Database db) async {
    // Create unified storage table with better schema
    await db.execute('''
      CREATE TABLE IF NOT EXISTS unified_storage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        box_name TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        value_type TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER,
        UNIQUE(box_name, key)
      )
    ''');

    // Create indexes for better performance
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_unified_box_name ON unified_storage(box_name)
    ''');
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_unified_box_key ON unified_storage(box_name, key)
    ''');
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_unified_expires ON unified_storage(expires_at)
    ''');

    // Create metadata table for storage management
    await db.execute('''
      CREATE TABLE IF NOT EXISTS storage_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ''');
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
    await _database!.delete(
      'unified_storage',
      where: 'box_name = ?',
      whereArgs: [boxName],
    );
    await closeBox(boxName);
  }

  @override
  Future<void> clearBox(String boxName) async {
    _ensureInitialized();
    await _database!.delete(
      'unified_storage',
      where: 'box_name = ?',
      whereArgs: [boxName],
    );
  }

  @override
  Future<T?> getValue<T>(String boxName, String key, {T? defaultValue}) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'unified_storage',
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
        limit: 1,
      );

      if (result.isEmpty) {
        return defaultValue;
      }

      final row = result.first;
      final value = row['value'] as String?;
      final valueType = row['value_type'] as String?;
      final expiresAt = row['expires_at'] as int?;

      // Check expiration
      if (expiresAt != null && DateTime.now().millisecondsSinceEpoch > expiresAt) {
        await deleteKey(boxName, key);
        return defaultValue;
      }

      if (value == null) {
        return defaultValue;
      }

      return _deserializeValue<T>(value, valueType);
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter getValue error: $e');
      return defaultValue;
    }
  }

  @override
  Future<void> putValue<T>(String boxName, String key, T value) async {
    _ensureInitialized();
    
    try {
      final serialized = _serializeValue<T>(value);
      final now = DateTime.now().millisecondsSinceEpoch;

      await _database!.insert(
        'unified_storage',
        {
          'box_name': boxName,
          'key': key,
          'value': serialized.value,
          'value_type': serialized.type,
          'created_at': now,
          'updated_at': now,
          'expires_at': null, // No expiration by default
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      // Notify listeners
      _notifyChange(boxName, key, value, StorageChangeType.updated);
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter putValue error: $e');
      rethrow;
    }
  }

  @override
  Future<void> deleteKey(String boxName, String key) async {
    _ensureInitialized();
    
    try {
      await _database!.delete(
        'unified_storage',
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
      );

      // Notify listeners
      _notifyChange(boxName, key, null, StorageChangeType.deleted);
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter deleteKey error: $e');
      rethrow;
    }
  }

  @override
  Future<bool> containsKey(String boxName, String key) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'unified_storage',
        columns: ['id'],
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
        limit: 1,
      );

      return result.isNotEmpty;
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter containsKey error: $e');
      return false;
    }
  }

  @override
  Future<Iterable<dynamic>> getKeys(String boxName) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'unified_storage',
        columns: ['key'],
        where: 'box_name = ?',
        whereArgs: [boxName],
      );

      return result.map((row) => row['key'] as String);
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter getKeys error: $e');
      return [];
    }
  }

  @override
  Future<Map<String, dynamic>> getAllFromBox(String boxName) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'unified_storage',
        where: 'box_name = ?',
        whereArgs: [boxName],
      );

      final Map<String, dynamic> data = {};
      for (final row in result) {
        final key = row['key'] as String;
        final value = row['value'] as String?;
        final valueType = row['value_type'] as String?;
        final expiresAt = row['expires_at'] as int?;

        // Check expiration
        if (expiresAt != null && DateTime.now().millisecondsSinceEpoch > expiresAt) {
          await deleteKey(boxName, key);
          continue;
        }

        if (value != null) {
          data[key] = _deserializeValue<dynamic>(value, valueType);
        }
      }

      return data;
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter getAllFromBox error: $e');
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

  /// Set value with expiration
  Future<void> putValueWithExpiry<T>(
    String boxName, 
    String key, 
    T value, 
    Duration expiry,
  ) async {
    _ensureInitialized();
    
    try {
      final serialized = _serializeValue<T>(value);
      final now = DateTime.now().millisecondsSinceEpoch;
      final expiresAt = now + expiry.inMilliseconds;

      await _database!.insert(
        'unified_storage',
        {
          'box_name': boxName,
          'key': key,
          'value': serialized.value,
          'value_type': serialized.type,
          'created_at': now,
          'updated_at': now,
          'expires_at': expiresAt,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      // Notify listeners
      _notifyChange(boxName, key, value, StorageChangeType.updated);
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter putValueWithExpiry error: $e');
      rethrow;
    }
  }

  /// Clean up expired entries
  Future<int> cleanupExpiredEntries() async {
    _ensureInitialized();
    
    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      final result = await _database!.delete(
        'unified_storage',
        where: 'expires_at IS NOT NULL AND expires_at < ?',
        whereArgs: [now],
      );

      debugPrint('Cleaned up $result expired entries');
      return result;
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter cleanupExpiredEntries error: $e');
      return 0;
    }
  }

  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    _ensureInitialized();
    
    try {
      final totalResult = await _database!.rawQuery(
        'SELECT COUNT(*) as total FROM unified_storage'
      );
      final total = totalResult.first['total'] as int;

      final boxResult = await _database!.rawQuery(
        'SELECT box_name, COUNT(*) as count FROM unified_storage GROUP BY box_name'
      );

      final Map<String, int> boxStats = {};
      for (final row in boxResult) {
        boxStats[row['box_name'] as String] = row['count'] as int;
      }

      return {
        'total_entries': total,
        'box_stats': boxStats,
        'database_size': await _getDatabaseSize(),
      };
    } catch (e) {
      debugPrint('UnifiedSQLiteStorageAdapter getStorageStats error: $e');
      return {};
    }
  }

  /// Get database file size
  Future<int> _getDatabaseSize() async {
    if (kIsWeb) {
      return 0;
    }
    
    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      final dbPath = join(
        documentsDirectory.path,
        _subDirectory!,
        '${_appName}_unified.db',
      );
      final file = File(dbPath);
      if (await file.exists()) {
        return await file.length();
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  /// Dispose resources
  Future<void> dispose() async {
    for (final controller in _changeControllers.values) {
      await controller.close();
    }
    _changeControllers.clear();
    await _database?.close();
    _database = null;
    _isInitialized = false;
  }

  void _ensureInitialized() {
    if (!_isInitialized || _database == null) {
      throw StateError('UnifiedSQLiteStorageAdapter not initialized. Call init() first.');
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

  /// Serialize value to string with type information
  _SerializedValue _serializeValue<T>(T value) {
    if (value == null) {
      return _SerializedValue('', 'null');
    }
    
    if (value is String) {
      return _SerializedValue(value, 'String');
    } else if (value is int) {
      return _SerializedValue(value.toString(), 'int');
    } else if (value is double) {
      return _SerializedValue(value.toString(), 'double');
    } else if (value is bool) {
      return _SerializedValue(value.toString(), 'bool');
    } else if (value is List) {
      return _SerializedValue(jsonEncode(value), 'List');
    } else if (value is Map) {
      return _SerializedValue(jsonEncode(value), 'Map');
    } else {
      // For complex objects, serialize to JSON
      return _SerializedValue(jsonEncode(value), 'Object');
    }
  }

  /// Deserialize value from string with type information
  T? _deserializeValue<T>(String? value, String? type) {
    if (value == null || value.isEmpty) {
      return null;
    }

    if (type == 'null') {
      return null;
    } else if (type == 'String') {
      return value as T;
    } else if (type == 'int') {
      return int.parse(value) as T;
    } else if (type == 'double') {
      return double.parse(value) as T;
    } else if (type == 'bool') {
      return (value == 'true') as T;
    } else if (type == 'List') {
      return jsonDecode(value) as T;
    } else if (type == 'Map') {
      return jsonDecode(value) as T;
    } else if (type == 'Object') {
      return jsonDecode(value) as T;
    } else {
      // Fallback to string
      return value as T;
    }
  }
}

/// Helper class for serialized values
class _SerializedValue {
  final String value;
  final String type;

  _SerializedValue(this.value, this.type);
}
