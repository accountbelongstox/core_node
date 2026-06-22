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
import 'dart:collection';
import '../interfaces/cache_service_interface.dart';
import '../models/storage_result.dart';

/// Memory cache implementation with LRU eviction and TTL support
class MemoryCacheService implements CacheService {
  final Map<String, _CacheEntry> _cache = <String, _CacheEntry>{};
  final LinkedHashMap<String, String> _accessOrder = LinkedHashMap<String, String>();
  int _maxSize = 1000;
  Duration _defaultExpiry = const Duration(hours: 1);
  int _hits = 0;
  int _misses = 0;
  Timer? _cleanupTimer;
  bool _isInitialized = false;
  
  @override
  Future<StorageResult<void>> initialize({
    int? maxSize,
    Duration? defaultExpiry,
  }) async {
    try {
      if (_isInitialized) {
        return const StorageSuccess(null);
      }
      
      _maxSize = maxSize ?? 1000;
      _defaultExpiry = defaultExpiry ?? const Duration(hours: 1);
      
      // Start periodic cleanup
      _cleanupTimer = Timer.periodic(
        const Duration(minutes: 5),
        (_) => _cleanupExpired(),
      );
      
      _isInitialized = true;
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to initialize memory cache',
      );
    }
  }
  
  @override
  Future<StorageResult<T?>> get<T>(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final entry = _cache[key];
      if (entry == null || entry.isExpired) {
        _misses++;
        if (entry != null && entry.isExpired) {
          _removeEntry(key);
        }
        return const StorageSuccess(null);
      }
      
      _hits++;
      _updateAccessOrder(key);
      
      return StorageSuccess(entry.value as T?);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get value from cache for key: $key',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> set<T>(
    String key, 
    T value, {
    Duration? expiry,
  }) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final expiryTime = DateTime.now().add(expiry ?? _defaultExpiry);
      final entry = _CacheEntry(value, expiryTime);
      
      _cache[key] = entry;
      _updateAccessOrder(key);
      
      // Evict if over capacity
      if (_cache.length > _maxSize) {
        _evictLRU();
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set value in cache for key: $key',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> remove(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      _removeEntry(key);
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to remove value from cache for key: $key',
      );
    }
  }
  
  @override
  Future<StorageResult<bool>> contains(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final entry = _cache[key];
      if (entry == null || entry.isExpired) {
        if (entry != null && entry.isExpired) {
          _removeEntry(key);
        }
        return const StorageSuccess(false);
      }
      
      _updateAccessOrder(key);
      return const StorageSuccess(true);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to check if key exists in cache: $key',
      );
    }
  }
  
  @override
  Future<StorageResult<Map<String, T?>>> getMultiple<T>(List<String> keys) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final result = <String, T?>{};
      
      for (final key in keys) {
        final getResult = await get<T>(key);
        if (getResult.isSuccess) {
          result[key] = getResult.data;
        }
      }
      
      return StorageSuccess(result);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get multiple values from cache',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> setMultiple<T>(
    Map<String, T> values, {
    Duration? expiry,
  }) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      for (final entry in values.entries) {
        final setResult = await set(entry.key, entry.value, expiry: expiry);
        if (setResult.isError) {
          return setResult;
        }
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to set multiple values in cache',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> removeMultiple(List<String> keys) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      for (final key in keys) {
        _removeEntry(key);
      }
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to remove multiple values from cache',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> clear() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      _cache.clear();
      _accessOrder.clear();
      _hits = 0;
      _misses = 0;
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to clear cache',
      );
    }
  }
  
  @override
  Future<StorageResult<CacheStats>> getStats() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final totalRequests = _hits + _misses;
      final hitRatio = totalRequests > 0 ? _hits / totalRequests : 0.0;
      
      return StorageSuccess(CacheStats(
        size: _cache.length,
        maxSize: _maxSize,
        hits: _hits,
        misses: _misses,
        hitRatio: hitRatio,
        lastUpdated: DateTime.now(),
      ));
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get cache stats',
      );
    }
  }
  
  @override
  Future<StorageResult<List<String>>> getKeysMatching(String pattern) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final regex = RegExp(pattern);
      final matchingKeys = _cache.keys
          .where((key) => regex.hasMatch(key))
          .toList();
      
      return StorageSuccess(matchingKeys);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get keys matching pattern: $pattern',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> removeKeysMatching(String pattern) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final keysResult = await getKeysMatching(pattern);
      if (keysResult.isError) {
        return keysResult;
      }
      
      return removeMultiple(keysResult.data!);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to remove keys matching pattern: $pattern',
      );
    }
  }
  
  @override
  Future<StorageResult<Duration?>> getTimeUntilExpiry(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final entry = _cache[key];
      if (entry == null || entry.isExpired) {
        return const StorageSuccess(null);
      }
      
      final timeUntilExpiry = entry.expiryTime.difference(DateTime.now());
      return StorageSuccess(timeUntilExpiry.isNegative ? Duration.zero : timeUntilExpiry);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to get time until expiry for key: $key',
      );
    }
  }
  
  @override
  Future<StorageResult<bool>> refresh(String key) async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final entry = _cache[key];
      if (entry == null || entry.isExpired) {
        return const StorageSuccess(false);
      }
      
      // Reset expiry time
      entry.expiryTime = DateTime.now().add(_defaultExpiry);
      _updateAccessOrder(key);
      
      return const StorageSuccess(true);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to refresh cache entry for key: $key',
      );
    }
  }
  
  @override
  Future<StorageResult<int>> cleanupExpired() async {
    try {
      if (!_isInitialized) {
        return StorageError.withCode(
          'NOT_INITIALIZED',
          'Cache service not initialized',
        );
      }
      
      final expiredKeys = <String>[];
      
      for (final entry in _cache.entries) {
        if (entry.value.isExpired) {
          expiredKeys.add(entry.key);
        }
      }
      
      for (final key in expiredKeys) {
        _removeEntry(key);
      }
      
      return StorageSuccess(expiredKeys.length);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to cleanup expired cache entries',
      );
    }
  }
  
  @override
  Future<StorageResult<void>> close() async {
    try {
      _cleanupTimer?.cancel();
      _cleanupTimer = null;
      
      _cache.clear();
      _accessOrder.clear();
      _hits = 0;
      _misses = 0;
      _isInitialized = false;
      
      return const StorageSuccess(null);
    } catch (e) {
      return StorageError.fromException(
        e is Exception ? e : Exception(e.toString()),
        message: 'Failed to close cache service',
      );
    }
  }
  
  void _updateAccessOrder(String key) {
    _accessOrder.remove(key);
    _accessOrder[key] = key;
  }
  
  void _removeEntry(String key) {
    _cache.remove(key);
    _accessOrder.remove(key);
  }
  
  void _evictLRU() {
    if (_accessOrder.isNotEmpty) {
      final lruKey = _accessOrder.keys.first;
      _removeEntry(lruKey);
    }
  }
  
  void _cleanupExpired() {
    final expiredKeys = <String>[];
    
    for (final entry in _cache.entries) {
      if (entry.value.isExpired) {
        expiredKeys.add(entry.key);
      }
    }
    
    for (final key in expiredKeys) {
      _removeEntry(key);
    }
  }
}

/// Cache entry with expiry support
class _CacheEntry {
  final dynamic value;
  DateTime expiryTime;
  
  _CacheEntry(this.value, this.expiryTime);
  
  bool get isExpired => DateTime.now().isAfter(expiryTime);
}
