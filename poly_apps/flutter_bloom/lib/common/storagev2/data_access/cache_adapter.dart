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

import '../interfaces/cache_service_interface.dart';
import '../models/storage_result.dart';

/// Cache adapter for data caching operations
class CacheAdapter {
  final CacheService _cacheService;
  bool _isInitialized = false;
  
  CacheAdapter({required CacheService cacheService})
      : _cacheService = cacheService;
  
  /// Initialize cache adapter
  Future<StorageResult<void>> initialize({int? maxSize, Duration? defaultExpiry}) async {
    try {
      final result = await _cacheService.initialize(
        maxSize: maxSize,
        defaultExpiry: defaultExpiry,
      );
      if (result is StorageError) {
        return result;
      }
      
      _isInitialized = true;
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize cache adapter',
      );
    }
  }
  
  /// Get cached value
  Future<StorageResult<T?>> get<T>(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.get<T>(key);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get cached value: $key',
      );
    }
  }
  
  /// Set cached value
  Future<StorageResult<void>> set<T>(String key, T value, {Duration? expiry}) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.set<T>(key, value, expiry: expiry);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set cached value: $key',
      );
    }
  }
  
  /// Remove cached value
  Future<StorageResult<void>> remove(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.remove(key);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to remove cached value: $key',
      );
    }
  }
  
  /// Check if key exists in cache
  Future<StorageResult<bool>> contains(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.contains(key);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to check cache contains: $key',
      );
    }
  }
  
  /// Get multiple cached values
  Future<StorageResult<Map<String, T?>>> getMultiple<T>(List<String> keys) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.getMultiple<T>(keys);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get multiple cached values',
      );
    }
  }
  
  /// Set multiple cached values
  Future<StorageResult<void>> setMultiple<T>(
    Map<String, T> values, {
    Duration? expiry,
  }) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.setMultiple<T>(values, expiry: expiry);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set multiple cached values',
      );
    }
  }
  
  /// Remove multiple cached values
  Future<StorageResult<void>> removeMultiple(List<String> keys) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.removeMultiple(keys);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to remove multiple cached values',
      );
    }
  }
  
  /// Clear all cached values
  Future<StorageResult<void>> clear() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.clear();
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to clear cache',
      );
    }
  }
  
  /// Get cache statistics
  Future<StorageResult<CacheStats>> getStats() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.getStats();
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get cache statistics',
      );
    }
  }
  
  /// Get keys matching pattern
  Future<StorageResult<List<String>>> getKeysMatching(String pattern) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.getKeysMatching(pattern);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get keys matching pattern: $pattern',
      );
    }
  }
  
  /// Remove keys matching pattern
  Future<StorageResult<void>> removeKeysMatching(String pattern) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.removeKeysMatching(pattern);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to remove keys matching pattern: $pattern',
      );
    }
  }
  
  /// Get time until expiry for a key
  Future<StorageResult<Duration?>> getTimeUntilExpiry(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.getTimeUntilExpiry(key);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get time until expiry for key: $key',
      );
    }
  }
  
  /// Refresh a cached value
  Future<StorageResult<bool>> refresh(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.refresh(key);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to refresh cached value: $key',
      );
    }
  }
  
  /// Cleanup expired entries
  Future<StorageResult<int>> cleanupExpired() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache adapter not initialized',
        );
      }
      
      return await _cacheService.cleanupExpired();
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to cleanup expired cache entries',
      );
    }
  }
  
  /// Close cache adapter
  Future<StorageResult<void>> close() async {
    try {
      final result = await _cacheService.close();
      if (result is StorageError) {
        return result;
      }
      
      _isInitialized = false;
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close cache adapter',
      );
    }
  }
  
  /// Check if adapter is initialized
  bool get isInitialized => _isInitialized;
}
