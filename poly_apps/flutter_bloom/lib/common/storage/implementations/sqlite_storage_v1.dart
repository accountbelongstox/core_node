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
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import '../interfaces/storage_interface.dart';
import '../models/storage_models.dart';

/// SQLite-based storage implementation for v1 storage system
/// Replaces HiveStorage to eliminate Hive dependency while maintaining API compatibility
class SQLiteStorageV1 implements KeyValueStorageInterface {
  static SQLiteStorageV1? _instance;
  static SQLiteStorageV1 get instance => _instance ??= SQLiteStorageV1._internal();

  SQLiteStorageV1._internal();

  Database? _database;
  final Map<String, StreamController<StorageChange>> _changeControllers = {};
  String? _appName;
  String? _subDirectory;
  bool _isInitialized = false;

  @override
  Future<void> init({String? appName, String? subDirectory}) async {
    if (_isInitialized) return;

    _appName = appName ?? 'flutter_bloom';
    _subDirectory = subDirectory ?? 'storage_v1';

    try {
      final documentsDirectory = await getApplicationDocumentsDirectory();
      final dbPath = join(
        documentsDirectory.path,
        _subDirectory!,
        '${_appName}_storage_v1.db',
      );

      // Ensure directory exists
      final dbDir = join(documentsDirectory.path, _subDirectory!);
      await Directory(dbDir).create(recursive: true);

      _database = await openDatabase(
        dbPath,
        version: 1,
        onCreate: (db, version) async {
          // Create storage table
          await db.execute('''
            CREATE TABLE storage_boxes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              box_name TEXT NOT NULL,
              key TEXT NOT NULL,
              value TEXT,
              value_type TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              UNIQUE(box_name, key)
            )
          ''');

          // Create indexes for better performance
          await db.execute('''
            CREATE INDEX idx_box_name ON storage_boxes(box_name)
          ''');
          await db.execute('''
            CREATE INDEX idx_box_key ON storage_boxes(box_name, key)
          ''');
        },
      );

      _isInitialized = true;
      debugPrint('SQLiteStorageV1 initialized successfully: $dbPath');
    } catch (e) {
      debugPrint('SQLiteStorageV1 initialization failed: $e');
      rethrow;
    }
  }

  @override
  Future<void> openBox(String boxName) async {
    _ensureInitialized();
    // SQLite doesn't need explicit box opening, but we can track opened boxes
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
      'storage_boxes',
      where: 'box_name = ?',
      whereArgs: [boxName],
    );
    await closeBox(boxName);
  }

  @override
  Future<void> clearBox(String boxName) async {
    _ensureInitialized();
    await _database!.delete(
      'storage_boxes',
      where: 'box_name = ?',
      whereArgs: [boxName],
    );
  }

  @override
  Future<T?> getValue<T>(String boxName, String key, {T? defaultValue}) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'storage_boxes',
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

      if (value == null) {
        return defaultValue;
      }

      return _deserializeValue<T>(value, valueType);
    } catch (e) {
      debugPrint('SQLiteStorageV1 getValue error: $e');
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
        'storage_boxes',
        {
          'box_name': boxName,
          'key': key,
          'value': serialized.value,
          'value_type': serialized.type,
          'created_at': now,
          'updated_at': now,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      // Notify listeners
      _notifyChange(boxName, key, value, StorageChangeType.updated);
    } catch (e) {
      debugPrint('SQLiteStorageV1 putValue error: $e');
      rethrow;
    }
  }

  @override
  Future<void> deleteKey(String boxName, String key) async {
    _ensureInitialized();
    
    try {
      await _database!.delete(
        'storage_boxes',
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
      );

      // Notify listeners
      _notifyChange(boxName, key, null, StorageChangeType.deleted);
    } catch (e) {
      debugPrint('SQLiteStorageV1 deleteKey error: $e');
      rethrow;
    }
  }

  @override
  Future<bool> containsKey(String boxName, String key) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'storage_boxes',
        columns: ['id'],
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
        limit: 1,
      );

      return result.isNotEmpty;
    } catch (e) {
      debugPrint('SQLiteStorageV1 containsKey error: $e');
      return false;
    }
  }

  @override
  Future<Iterable<dynamic>> getKeys(String boxName) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'storage_boxes',
        columns: ['key'],
        where: 'box_name = ?',
        whereArgs: [boxName],
      );

      return result.map((row) => row['key'] as String);
    } catch (e) {
      debugPrint('SQLiteStorageV1 getKeys error: $e');
      return [];
    }
  }

  @override
  Future<Map<String, dynamic>> getAllFromBox(String boxName) async {
    _ensureInitialized();
    
    try {
      final result = await _database!.query(
        'storage_boxes',
        where: 'box_name = ?',
        whereArgs: [boxName],
      );

      final Map<String, dynamic> data = {};
      for (final row in result) {
        final key = row['key'] as String;
        final value = row['value'] as String?;
        final valueType = row['value_type'] as String?;

        if (value != null) {
          data[key] = _deserializeValue<dynamic>(value, valueType);
        }
      }

      return data;
    } catch (e) {
      debugPrint('SQLiteStorageV1 getAllFromBox error: $e');
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
      throw StateError('SQLiteStorageV1 not initialized. Call init() first.');
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
