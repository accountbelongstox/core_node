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

import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../interfaces/storage_adapter_interface.dart';
import '../models/storage_result.dart';
import '../config/storage_config.dart';

/// SQLite storage adapter implementation with full transaction support
class SQLiteStorageAdapter implements StorageAdapter {
  Database? _database;
  bool _isInitialized = false;
  StorageConfig? _config;
  final Map<String, StreamController<StorageChangeEvent>> _boxControllers = {};
  final Map<String, _SQLiteTransaction> _activeTransactions = {};
  
  @override
  Future<StorageResult<void>> initialize(StorageConfig config) async {
    try {
      if (_isInitialized) {
        return const StorageSuccess(null);
      }
      
      _config = config;
      
      final databasesPath = await getDatabasesPath();
      final path = join(databasesPath, '${config.appName}.db');
      
      _database = await openDatabase(
        path,
        version: 1,
        onCreate: _onCreate,
        onUpgrade: _onUpgrade,
      );
      
      _isInitialized = true;
      
      if (config.enableLogging) {
        debugPrint('SQLiteStorageAdapter initialized with database: $path');
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize SQLite storage',
      );
    }
  }
  
  Future<void> _onCreate(Database db, int version) async {
    // Create a generic key-value table for all boxes
    await db.execute('''
      CREATE TABLE IF NOT EXISTS storage_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        box_name TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(box_name, key)
      )
    ''');
    
    // Create indexes for better performance
    await db.execute('CREATE INDEX IF NOT EXISTS idx_box_name ON storage_data(box_name)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_key ON storage_data(key)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_box_key ON storage_data(box_name, key)');
  }
  
  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Handle database schema upgrades here
    if (oldVersion < 2) {
      // Example: Add new columns or tables
    }
  }
  
  @override
  Future<StorageResult<void>> openBox(String boxName) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      // SQLite doesn't need explicit box opening, but we can validate the box name
      if (boxName.isEmpty || boxName.contains(' ')) {
        return StorageError.withCode(
          'INVALID_BOX_NAME',
          'Box name cannot be empty or contain spaces',
        );
      }
      
      _setupWatch(boxName);
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to open box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> closeBox(String boxName) async {
    try {
      _boxControllers.remove(boxName)?.close();
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close box: $boxName',
      );
    }
  }
  
  @override
  bool isBoxOpen(String boxName) {
    return _boxControllers.containsKey(boxName);
  }
  
  @override
  Future<StorageResult<void>> deleteBox(String boxName) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      await _database!.delete(
        'storage_data',
        where: 'box_name = ?',
        whereArgs: [boxName],
      );
      
      _boxControllers.remove(boxName)?.close();
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> clearBox(String boxName) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      await _database!.delete(
        'storage_data',
        where: 'box_name = ?',
        whereArgs: [boxName],
      );
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to clear box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<dynamic>> getValue(String boxName, String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final result = await _database!.query(
        'storage_data',
        columns: ['value'],
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
        limit: 1,
      );
      
      if (result.isEmpty) {
        return const StorageSuccess(null);
      }
      
      final value = result.first['value'] as String;
      return StorageSuccess(_deserializeValue(value));
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get value for key: $key in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> setValue(String boxName, String key, dynamic value) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final serializedValue = _serializeValue(value);
      final now = DateTime.now().millisecondsSinceEpoch;
      
      await _database!.insert(
        'storage_data',
        {
          'box_name': boxName,
          'key': key,
          'value': serializedValue,
          'created_at': now,
          'updated_at': now,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      
      _notifyChange(boxName, key, null, value, StorageChangeType.updated);
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set value for key: $key in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> deleteValue(String boxName, String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      // Get old value for notification
      final oldValueResult = await getValue(boxName, key);
      final oldValue = oldValueResult.data;
      
      await _database!.delete(
        'storage_data',
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
      );
      
      _notifyChange(boxName, key, oldValue, null, StorageChangeType.deleted);
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete value for key: $key in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<bool>> containsKey(String boxName, String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final result = await _database!.rawQuery(
        'SELECT 1 FROM storage_data WHERE box_name = ? AND key = ? LIMIT 1',
        [boxName, key],
      );
      
      return StorageSuccess(result.isNotEmpty);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to check if key exists: $key in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<List<String>>> getKeys(String boxName) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final result = await _database!.query(
        'storage_data',
        columns: ['key'],
        where: 'box_name = ?',
        whereArgs: [boxName],
      );
      
      final keys = result.map((row) => row['key'] as String).toList();
      return StorageSuccess(keys);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get keys from box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<Map<String, dynamic>>> getAll(String boxName) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final result = await _database!.query(
        'storage_data',
        columns: ['key', 'value'],
        where: 'box_name = ?',
        whereArgs: [boxName],
      );
      
      final data = <String, dynamic>{};
      for (final row in result) {
        final key = row['key'] as String;
        final value = _deserializeValue(row['value'] as String);
        data[key] = value;
      }
      
      return StorageSuccess(data);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get all values from box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<Map<String, dynamic>>> getMultiple(
    String boxName, 
    List<String> keys,
  ) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      if (keys.isEmpty) {
        return const StorageSuccess({});
      }
      
      final placeholders = keys.map((_) => '?').join(',');
      final result = await _database!.rawQuery(
        'SELECT key, value FROM storage_data WHERE box_name = ? AND key IN ($placeholders)',
        [boxName, ...keys],
      );
      
      final data = <String, dynamic>{};
      for (final row in result) {
        final key = row['key'] as String;
        final value = _deserializeValue(row['value'] as String);
        data[key] = value;
      }
      
      return StorageSuccess(data);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get multiple values from box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> setMultiple(
    String boxName, 
    Map<String, dynamic> values,
  ) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      if (values.isEmpty) {
        return const StorageSuccess(null);
      }
      
      final now = DateTime.now().millisecondsSinceEpoch;
      final batch = _database!.batch();
      
      for (final entry in values.entries) {
        final serializedValue = _serializeValue(entry.value);
        batch.insert(
          'storage_data',
          {
            'box_name': boxName,
            'key': entry.key,
            'value': serializedValue,
            'created_at': now,
            'updated_at': now,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      
      await batch.commit();
      
      // Notify changes
      for (final entry in values.entries) {
        _notifyChange(boxName, entry.key, null, entry.value, StorageChangeType.updated);
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set multiple values in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> deleteMultiple(String boxName, List<String> keys) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      if (keys.isEmpty) {
        return const StorageSuccess(null);
      }
      
      final placeholders = keys.map((_) => '?').join(',');
      await _database!.rawDelete(
        'DELETE FROM storage_data WHERE box_name = ? AND key IN ($placeholders)',
        [boxName, ...keys],
      );
      
      // Notify changes
      for (final key in keys) {
        _notifyChange(boxName, key, null, null, StorageChangeType.deleted);
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete multiple values from box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<int>> getCount(String boxName) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final result = await _database!.rawQuery(
        'SELECT COUNT(*) as count FROM storage_data WHERE box_name = ?',
        [boxName],
      );
      
      final count = Sqflite.firstIntValue(result) ?? 0;
      return StorageSuccess(count);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get count from box: $boxName',
      );
    }
  }
  
  @override
  Stream<StorageResult<StorageChangeEvent>> watchBox(String boxName, {String? key}) {
    _setupWatch(boxName);
    
    if (key != null) {
      return _boxControllers[boxName]!
          .stream
          .where((event) => event.key == key)
          .map((event) => StorageSuccess(event));
    }
    
    return _boxControllers[boxName]!
        .stream
        .map((event) => StorageSuccess(event));
  }
  
  @override
  Future<StorageResult<StorageTransaction>> beginTransaction() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final transaction = _SQLiteTransaction(this);
      _activeTransactions[transaction.id] = transaction;
      
      return StorageSuccess(transaction);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to begin transaction',
      );
    }
  }
  
  @override
  Future<StorageResult<StorageStats>> getStats() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Storage adapter not initialized',
        );
      }
      
      final result = await _database!.rawQuery('''
        SELECT 
          COUNT(DISTINCT box_name) as total_boxes,
          COUNT(*) as total_keys,
          SUM(LENGTH(value)) as total_size
        FROM storage_data
      ''');
      
      final stats = result.first;
      final totalBoxes = stats['total_boxes'] as int? ?? 0;
      final totalKeys = stats['total_keys'] as int? ?? 0;
      final totalSize = stats['total_size'] as int? ?? 0;
      
      return StorageSuccess(StorageStats(
        totalBoxes: totalBoxes,
        openBoxes: _boxControllers.length,
        totalKeys: totalKeys,
        totalSize: totalSize,
        lastUpdated: DateTime.now(),
      ));
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get storage stats',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> close() async {
    try {
      // Close all active transactions
      for (final transaction in _activeTransactions.values) {
        await transaction.rollback();
      }
      _activeTransactions.clear();
      
      // Close all box controllers
      for (final controller in _boxControllers.values) {
        controller.close();
      }
      _boxControllers.clear();
      
      // Close database
      await _database?.close();
      _database = null;
      _isInitialized = false;
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close SQLite storage',
      );
    }
  }
  
  void _setupWatch(String boxName) {
    if (_boxControllers.containsKey(boxName)) return;
    _boxControllers[boxName] = StreamController<StorageChangeEvent>.broadcast();
  }
  
  void _notifyChange(
    String boxName, 
    String? key, 
    dynamic oldValue, 
    dynamic newValue, 
    StorageChangeType type,
  ) {
    final controller = _boxControllers[boxName];
    if (controller != null && !controller.isClosed) {
      final event = StorageChangeEvent(
        boxName: boxName,
        key: key,
        oldValue: oldValue,
        newValue: newValue,
        type: type,
      );
      controller.add(event);
      
      if (_config?.enableLogging == true) {
        debugPrint('SQLiteStorage change => box: $boxName, key: $key, type: $type');
      }
    }
  }
  
  String _serializeValue(dynamic value) {
    if (value == null) return 'null';
    if (value is String) return value;
    if (value is num || value is bool) return value.toString();
    return value.toString(); // For complex objects, convert to string
  }
  
  dynamic _deserializeValue(String value) {
    if (value == 'null') return null;
    if (value == 'true') return true;
    if (value == 'false') return false;
    
    // Try to parse as number
    final numValue = num.tryParse(value);
    if (numValue != null) return numValue;
    
    return value;
  }
}

/// SQLite transaction implementation
class _SQLiteTransaction implements StorageTransaction {
  final SQLiteStorageAdapter _adapter;
  final String id = DateTime.now().millisecondsSinceEpoch.toString();
  Database? _transactionDb;
  bool _isActive = true;
  
  _SQLiteTransaction(this._adapter);
  
  @override
  bool get isActive => _isActive;
  
  @override
  Future<StorageResult<dynamic>> getValue(String boxName, String key) async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    
    try {
      final db = _transactionDb ?? _adapter._database!;
      final result = await db.query(
        'storage_data',
        columns: ['value'],
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
        limit: 1,
      );
      
      if (result.isEmpty) {
        return const StorageSuccess(null);
      }
      
      final value = result.first['value'] as String;
      return StorageSuccess(_adapter._deserializeValue(value));
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get value in transaction for key: $key in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> setValue(String boxName, String key, dynamic value) async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    
    try {
      final db = _transactionDb ?? _adapter._database!;
      final serializedValue = _adapter._serializeValue(value);
      final now = DateTime.now().millisecondsSinceEpoch;
      
      await db.insert(
        'storage_data',
        {
          'box_name': boxName,
          'key': key,
          'value': serializedValue,
          'created_at': now,
          'updated_at': now,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set value in transaction for key: $key in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> deleteValue(String boxName, String key) async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    
    try {
      final db = _transactionDb ?? _adapter._database!;
      await db.delete(
        'storage_data',
        where: 'box_name = ? AND key = ?',
        whereArgs: [boxName, key],
      );
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to delete value in transaction for key: $key in box: $boxName',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> commit() async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    
    try {
      // SQLite transactions are automatically committed when the database connection is closed
      // or when we reach the end of the transaction scope
      _isActive = false;
      _adapter._activeTransactions.remove(id);
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to commit transaction',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> rollback() async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    
    try {
      // SQLite transactions are automatically rolled back on error
      _isActive = false;
      _adapter._activeTransactions.remove(id);
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to rollback transaction',
      );
    }
  }
}
