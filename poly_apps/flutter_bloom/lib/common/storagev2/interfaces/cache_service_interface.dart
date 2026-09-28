import '../models/storage_result.dart';

/// Cache service interface for memory caching
abstract class CacheService {
  /// Initialize the cache service
  Future<StorageResult<void>> initialize({
    int? maxSize,
    Duration? defaultExpiry,
  });
  
  /// Get value from cache
  Future<StorageResult<T?>> get<T>(String key);
  
  /// Set value in cache
  Future<StorageResult<void>> set<T>(
    String key, 
    T value, {
    Duration? expiry,
  });
  
  /// Remove value from cache
  Future<StorageResult<void>> remove(String key);
  
  /// Check if key exists in cache
  Future<StorageResult<bool>> contains(String key);
  
  /// Get multiple values
  Future<StorageResult<Map<String, T?>>> getMultiple<T>(List<String> keys);
  
  /// Set multiple values
  Future<StorageResult<void>> setMultiple<T>(
    Map<String, T> values, {
    Duration? expiry,
  });
  
  /// Remove multiple keys
  Future<StorageResult<void>> removeMultiple(List<String> keys);
  
  /// Clear all cache
  Future<StorageResult<void>> clear();
  
  /// Get cache statistics
  Future<StorageResult<CacheStats>> getStats();
  
  /// Get keys matching pattern
  Future<StorageResult<List<String>>> getKeysMatching(String pattern);
  
  /// Remove keys matching pattern
  Future<StorageResult<void>> removeKeysMatching(String pattern);
  
  /// Get time until expiry
  Future<StorageResult<Duration?>> getTimeUntilExpiry(String key);
  
  /// Refresh cache entry (reset expiry)
  Future<StorageResult<bool>> refresh(String key);
  
  /// Clean up expired entries
  Future<StorageResult<int>> cleanupExpired();
  
  /// Close the cache service
  Future<StorageResult<void>> close();
}

/// Cache statistics
class CacheStats {
  final int size;
  final int maxSize;
  final int hits;
  final int misses;
  final double hitRatio;
  final DateTime lastUpdated;
  final Map<String, dynamic> customStats;
  
  const CacheStats({
    required this.size,
    required this.maxSize,
    required this.hits,
    required this.misses,
    required this.hitRatio,
    required this.lastUpdated,
    this.customStats = const {},
  });
  
  Map<String, dynamic> toMap() {
    return {
      'size': size,
      'maxSize': maxSize,
      'hits': hits,
      'misses': misses,
      'hitRatio': hitRatio,
      'lastUpdated': lastUpdated.toIso8601String(),
      'customStats': customStats,
    };
  }
  
  @override
  String toString() => 'CacheStats(size: $size/$maxSize, hitRatio: ${(hitRatio * 100).toStringAsFixed(1)}%)';
}
