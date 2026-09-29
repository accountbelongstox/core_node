import '../interfaces/storage_adapter_interface.dart';
import '../models/storage_result.dart';
import '../config/storage_config.dart';

/// Storage adapter coordinator for managing multiple storage backends
class StorageAdapterCoordinator implements StorageAdapter {
  final List<StorageAdapter> _adapters;
  final StorageConfig _config;
  StorageAdapter? _primaryAdapter;
  
  StorageAdapterCoordinator({
    required List<StorageAdapter> adapters,
    required StorageConfig config,
  }) : _adapters = adapters,
       _config = config {
    if (adapters.isNotEmpty) {
      _primaryAdapter = adapters.first;
    }
  }
  
  @override
  Future<StorageResult<void>> initialize(StorageConfig config) async {
    try {
      for (final adapter in _adapters) {
        final result = await adapter.initialize(config);
        if (result is StorageError) {
          return result;
        }
      }
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize storage adapters',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> openBox(String boxName) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.openBox(boxName);
  }
  
  @override
  Future<StorageResult<void>> closeBox(String boxName) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.closeBox(boxName);
  }
  
  @override
  bool isBoxOpen(String boxName) {
    if (_primaryAdapter == null) return false;
    return _primaryAdapter!.isBoxOpen(boxName);
  }
  
  @override
  Future<StorageResult<void>> deleteBox(String boxName) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.deleteBox(boxName);
  }
  
  @override
  Future<StorageResult<void>> clearBox(String boxName) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.clearBox(boxName);
  }
  
  @override
  Future<StorageResult<dynamic>> getValue(String boxName, String key) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.getValue(boxName, key);
  }
  
  @override
  Future<StorageResult<void>> setValue(String boxName, String key, dynamic value) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.setValue(boxName, key, value);
  }
  
  @override
  Future<StorageResult<void>> deleteValue(String boxName, String key) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.deleteValue(boxName, key);
  }
  
  @override
  Future<StorageResult<bool>> containsKey(String boxName, String key) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.containsKey(boxName, key);
  }
  
  @override
  Future<StorageResult<List<String>>> getKeys(String boxName) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.getKeys(boxName);
  }
  
  @override
  Future<StorageResult<Map<String, dynamic>>> getAll(String boxName) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.getAll(boxName);
  }
  
  @override
  Future<StorageResult<Map<String, dynamic>>> getMultiple(String boxName, List<String> keys) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.getMultiple(boxName, keys);
  }
  
  @override
  Future<StorageResult<void>> setMultiple(String boxName, Map<String, dynamic> values) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.setMultiple(boxName, values);
  }
  
  @override
  Future<StorageResult<void>> deleteMultiple(String boxName, List<String> keys) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.deleteMultiple(boxName, keys);
  }
  
  @override
  Future<StorageResult<int>> getCount(String boxName) async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.getCount(boxName);
  }
  
  @override
  Stream<StorageResult<StorageChangeEvent>> watchBox(String boxName, {String? key}) {
    if (_primaryAdapter == null) {
      return Stream.error(StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      ));
    }
    return _primaryAdapter!.watchBox(boxName, key: key);
  }
  
  @override
  Future<StorageResult<StorageTransaction>> beginTransaction() async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.beginTransaction();
  }
  
  @override
  Future<StorageResult<StorageStats>> getStats() async {
    if (_primaryAdapter == null) {
      return StorageError.withCode(
        'NO_ADAPTER',
        'No storage adapter available',
      );
    }
    return await _primaryAdapter!.getStats();
  }
  
  @override
  Future<StorageResult<void>> close() async {
    try {
      for (final adapter in _adapters) {
        await adapter.close();
      }
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close storage adapters',
      );
    }
  }
  
  /// Set primary adapter
  void setPrimaryAdapter(StorageAdapter adapter) {
    if (_adapters.contains(adapter)) {
      _primaryAdapter = adapter;
    }
  }
  
  /// Get all adapters
  List<StorageAdapter> get adapters => List.unmodifiable(_adapters);
  
  /// Get primary adapter
  StorageAdapter? get primaryAdapter => _primaryAdapter;
}
