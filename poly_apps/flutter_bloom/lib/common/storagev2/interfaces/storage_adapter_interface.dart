import '../models/storage_result.dart';
import '../config/storage_config.dart';

/// Storage adapter interface for different storage backends
abstract class StorageAdapter {
  /// Initialize the storage adapter
  Future<StorageResult<void>> initialize(StorageConfig config);
  
  /// Open a storage box/table/collection
  Future<StorageResult<void>> openBox(String boxName);
  
  /// Close a storage box/table/collection
  Future<StorageResult<void>> closeBox(String boxName);
  
  /// Check if box is open
  bool isBoxOpen(String boxName);
  
  /// Delete a storage box/table/collection
  Future<StorageResult<void>> deleteBox(String boxName);
  
  /// Clear all data from a box
  Future<StorageResult<void>> clearBox(String boxName);
  
  /// Get value by key
  Future<StorageResult<dynamic>> getValue(String boxName, String key);
  
  /// Set value by key
  Future<StorageResult<void>> setValue(String boxName, String key, dynamic value);
  
  /// Delete value by key
  Future<StorageResult<void>> deleteValue(String boxName, String key);
  
  /// Check if key exists
  Future<StorageResult<bool>> containsKey(String boxName, String key);
  
  /// Get all keys in a box
  Future<StorageResult<List<String>>> getKeys(String boxName);
  
  /// Get all key-value pairs in a box
  Future<StorageResult<Map<String, dynamic>>> getAll(String boxName);
  
  /// Get multiple values by keys
  Future<StorageResult<Map<String, dynamic>>> getMultiple(
    String boxName, 
    List<String> keys,
  );
  
  /// Set multiple key-value pairs
  Future<StorageResult<void>> setMultiple(
    String boxName, 
    Map<String, dynamic> values,
  );
  
  /// Delete multiple keys
  Future<StorageResult<void>> deleteMultiple(String boxName, List<String> keys);
  
  /// Get count of items in box
  Future<StorageResult<int>> getCount(String boxName);
  
  /// Watch for changes in a box
  Stream<StorageResult<StorageChangeEvent>> watchBox(String boxName, {String? key});
  
  /// Start a transaction
  Future<StorageResult<StorageTransaction>> beginTransaction();
  
  /// Get storage statistics
  Future<StorageResult<StorageStats>> getStats();
  
  /// Close the storage adapter
  Future<StorageResult<void>> close();
}

/// Storage change event
class StorageChangeEvent {
  final String boxName;
  final String? key;
  final dynamic oldValue;
  final dynamic newValue;
  final StorageChangeType type;
  final DateTime timestamp;
  
  StorageChangeEvent({
    required this.boxName,
    this.key,
    this.oldValue,
    this.newValue,
    required this.type,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();
  
  @override
  String toString() => 'StorageChangeEvent(box: $boxName, key: $key, type: $type)';
}

/// Storage transaction interface
abstract class StorageTransaction {
  /// Get value within transaction
  Future<StorageResult<dynamic>> getValue(String boxName, String key);
  
  /// Set value within transaction
  Future<StorageResult<void>> setValue(String boxName, String key, dynamic value);
  
  /// Delete value within transaction
  Future<StorageResult<void>> deleteValue(String boxName, String key);
  
  /// Commit transaction
  Future<StorageResult<void>> commit();
  
  /// Rollback transaction
  Future<StorageResult<void>> rollback();
  
  /// Check if transaction is active
  bool get isActive;
}

/// Storage statistics
class StorageStats {
  final int totalBoxes;
  final int openBoxes;
  final int totalKeys;
  final int totalSize;
  final DateTime lastUpdated;
  final Map<String, dynamic> customStats;
  
  const StorageStats({
    required this.totalBoxes,
    required this.openBoxes,
    required this.totalKeys,
    required this.totalSize,
    required this.lastUpdated,
    this.customStats = const {},
  });
  
  @override
  String toString() => 'StorageStats(boxes: $openBoxes/$totalBoxes, keys: $totalKeys)';
}
