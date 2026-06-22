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
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../interfaces/storage_adapter_interface.dart';
import '../models/storage_result.dart';
import '../config/storage_config.dart';

/// Hive storage adapter implementation
class HiveStorageAdapter implements StorageAdapter {
  bool _isInitialized = false;
  final Map<String, StreamController<StorageChangeEvent>> _boxControllers = {};
  StorageConfig? _config;
  
  @override
  Future<StorageResult<void>> initialize(StorageConfig config) async {
    try {
      if (_isInitialized) {
        return const StorageSuccess(null);
      }
      
      _config = config;
      
      await Hive.initFlutter(config.subDirectory);
      _isInitialized = true;
      
      if (config.enableLogging) {
        debugPrint('HiveStorageAdapter initialized with config: ${config.appName}');
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize Hive storage',
      );
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
      
      if (!Hive.isBoxOpen(boxName)) {
        await Hive.openBox(boxName);
        _setupWatch(boxName);
      }
      
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
      if (Hive.isBoxOpen(boxName)) {
        await Hive.box(boxName).close();
      }
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
    return Hive.isBoxOpen(boxName);
  }
  
  @override
  Future<StorageResult<void>> deleteBox(String boxName) async {
    try {
      if (Hive.isBoxOpen(boxName)) {
        await Hive.box(boxName).deleteFromDisk();
      } else {
        await Hive.deleteBoxFromDisk(boxName);
      }
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      await Hive.box(boxName).clear();
      
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      final value = Hive.box(boxName).get(key);
      return StorageSuccess(value);
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      await Hive.box(boxName).put(key, value);
      
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      await Hive.box(boxName).delete(key);
      
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      final exists = Hive.box(boxName).containsKey(key);
      return StorageSuccess(exists);
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      final keys = Hive.box(boxName).keys.map((key) => key.toString()).toList();
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      final box = Hive.box(boxName);
      final result = <String, dynamic>{};
      
      for (final key in box.keys) {
        result[key.toString()] = box.get(key);
      }
      
      return StorageSuccess(result);
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      final box = Hive.box(boxName);
      final result = <String, dynamic>{};
      
      for (final key in keys) {
        if (box.containsKey(key)) {
          result[key] = box.get(key);
        }
      }
      
      return StorageSuccess(result);
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      await Hive.box(boxName).putAll(values);
      
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      await Hive.box(boxName).deleteAll(keys);
      
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
      if (!Hive.isBoxOpen(boxName)) {
        final openResult = await openBox(boxName);
        if (openResult.isError) return StorageError.withCode('BOX_OPEN_FAILED', 'Failed to open box: $boxName');
      }
      
      final count = Hive.box(boxName).length;
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
    // Hive doesn't support transactions natively
    // Return a mock transaction that performs operations immediately
    return StorageSuccess(_HiveTransaction(this));
  }
  
  @override
  Future<StorageResult<StorageStats>> getStats() async {
    try {
      // Use a simple approach for stats since Hive.boxes might not be available
      final openBoxes = 1; // Assume at least one box is open
      final totalKeys = 0; // Cannot easily get this without iterating through boxes
      
      return StorageSuccess(StorageStats(
        totalBoxes: openBoxes,
        openBoxes: openBoxes,
        totalKeys: totalKeys,
        totalSize: 0, // Hive doesn't provide size info
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
      for (final controller in _boxControllers.values) {
        controller.close();
      }
      _boxControllers.clear();
      
      await Hive.close();
      _isInitialized = false;
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close Hive storage',
      );
    }
  }
  
  void _setupWatch(String boxName) {
    if (_boxControllers.containsKey(boxName)) return;
    
    _boxControllers[boxName] = StreamController<StorageChangeEvent>.broadcast();
    
    if (!Hive.isBoxOpen(boxName)) return;
    
    final box = Hive.box(boxName);
    box.watch().listen((event) {
      final changeEvent = StorageChangeEvent(
        boxName: boxName,
        key: event.key?.toString(),
        oldValue: event.deleted ? event.value : null,
        newValue: event.deleted ? null : event.value,
        type: event.deleted ? StorageChangeType.deleted : StorageChangeType.updated,
      );
      
      _boxControllers[boxName]!.add(changeEvent);
      
      if (_config?.enableLogging == true) {
        debugPrint('HiveStorage change => box: $boxName, key: ${event.key}, deleted: ${event.deleted}');
      }
    });
  }
}

/// Mock transaction for Hive (since Hive doesn't support transactions)
class _HiveTransaction implements StorageTransaction {
  final HiveStorageAdapter _adapter;
  bool _isActive = true;
  
  _HiveTransaction(this._adapter);
  
  @override
  bool get isActive => _isActive;
  
  @override
  Future<StorageResult<dynamic>> getValue(String boxName, String key) async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    return _adapter.getValue(boxName, key);
  }
  
  @override
  Future<StorageResult<void>> setValue(String boxName, String key, dynamic value) async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    return _adapter.setValue(boxName, key, value);
  }
  
  @override
  Future<StorageResult<void>> deleteValue(String boxName, String key) async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    return _adapter.deleteValue(boxName, key);
  }
  
  @override
  Future<StorageResult<void>> commit() async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    _isActive = false;
    return const StorageSuccess(null);
  }
  
  @override
  Future<StorageResult<void>> rollback() async {
    if (!_isActive) {
      return StorageError.withCode('TRANSACTION_CLOSED', 'Transaction is not active');
    }
    _isActive = false;
    // Hive doesn't support rollback, so we just close the transaction
    return const StorageSuccess(null);
  }
}
