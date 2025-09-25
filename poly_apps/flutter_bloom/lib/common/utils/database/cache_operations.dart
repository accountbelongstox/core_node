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

// Migrated from lib/util/idb_shim/operations/cache_op.dart
// This file provides database cache operations for the application

import 'dart:async';
import 'dart:convert';

class CacheOperations {
  static final Map<String, dynamic> _memoryCache = {};
  static final Map<String, DateTime> _cacheTimestamps = {};
  static const Duration _defaultCacheExpiry = Duration(hours: 1);

  /// Get data from cache
  static T? get<T>(String key) {
    if (_isExpired(key)) {
      remove(key);
      return null;
    }
    return _memoryCache[key] as T?;
  }

  /// Set data in cache
  static void set<T>(String key, T value, {Duration? expiry}) {
    _memoryCache[key] = value;
    _cacheTimestamps[key] = DateTime.now();
    
    // Auto-remove after expiry
    final expiryDuration = expiry ?? _defaultCacheExpiry;
    Timer(expiryDuration, () => remove(key));
  }

  /// Remove data from cache
  static void remove(String key) {
    _memoryCache.remove(key);
    _cacheTimestamps.remove(key);
  }

  /// Clear all cache
  static void clear() {
    _memoryCache.clear();
    _cacheTimestamps.clear();
  }

  /// Check if key exists in cache
  static bool contains(String key) {
    return _memoryCache.containsKey(key) && !_isExpired(key);
  }

  /// Get all cache keys
  static List<String> getKeys() {
    return _memoryCache.keys.toList();
  }

  /// Get cache size
  static int size() {
    return _memoryCache.length;
  }

  /// Check if cache is empty
  static bool isEmpty() {
    return _memoryCache.isEmpty;
  }

  /// Get cache statistics
  static Map<String, dynamic> getStats() {
    return {
      'size': size(),
      'keys': getKeys(),
      'timestamps': Map.from(_cacheTimestamps),
    };
  }

  /// Set data with JSON serialization
  static void setJson(String key, Map<String, dynamic> data, {Duration? expiry}) {
    set(key, jsonEncode(data), expiry: expiry);
  }

  /// Get data with JSON deserialization
  static Map<String, dynamic>? getJson(String key) {
    final jsonString = get<String>(key);
    if (jsonString == null) return null;
    
    try {
      return jsonDecode(jsonString) as Map<String, dynamic>;
    } catch (e) {
      remove(key); // Remove corrupted data
      return null;
    }
  }

  /// Set list data
  static void setList<T>(String key, List<T> list, {Duration? expiry}) {
    set(key, list, expiry: expiry);
  }

  /// Get list data
  static List<T>? getList<T>(String key) {
    final list = get<List<dynamic>>(key);
    return list?.cast<T>();
  }

  /// Increment numeric value
  static num increment(String key, {num by = 1}) {
    final current = get<num>(key) ?? 0;
    final newValue = current + by;
    set(key, newValue);
    return newValue;
  }

  /// Decrement numeric value
  static num decrement(String key, {num by = 1}) {
    return increment(key, by: -by);
  }

  /// Set if not exists
  static bool setIfNotExists<T>(String key, T value, {Duration? expiry}) {
    if (contains(key)) {
      return false;
    }
    set(key, value, expiry: expiry);
    return true;
  }

  /// Get or set (lazy loading)
  static T getOrSet<T>(String key, T Function() factory, {Duration? expiry}) {
    if (contains(key)) {
      return get<T>(key)!;
    }
    
    final value = factory();
    set(key, value, expiry: expiry);
    return value;
  }

  /// Get multiple keys
  static Map<String, T?> getMultiple<T>(List<String> keys) {
    final result = <String, T?>{};
    for (final key in keys) {
      result[key] = get<T>(key);
    }
    return result;
  }

  /// Set multiple key-value pairs
  static void setMultiple<T>(Map<String, T> data, {Duration? expiry}) {
    for (final entry in data.entries) {
      set(entry.key, entry.value, expiry: expiry);
    }
  }

  /// Remove multiple keys
  static void removeMultiple(List<String> keys) {
    for (final key in keys) {
      remove(key);
    }
  }

  /// Get keys matching pattern
  static List<String> getKeysMatching(Pattern pattern) {
    return getKeys().where((key) => pattern.allMatches(key).isNotEmpty).toList();
  }

  /// Remove keys matching pattern
  static void removeKeysMatching(Pattern pattern) {
    final keysToRemove = getKeysMatching(pattern);
    removeMultiple(keysToRemove);
  }

  /// Get cache hit ratio
  static double getHitRatio() {
    // This would require tracking hits and misses
    // For now, return a placeholder
    return 0.0;
  }

  /// Refresh cache entry (reset timestamp)
  static bool refresh(String key) {
    if (_memoryCache.containsKey(key)) {
      _cacheTimestamps[key] = DateTime.now();
      return true;
    }
    return false;
  }

  /// Get time until expiry
  static Duration? getTimeUntilExpiry(String key) {
    final timestamp = _cacheTimestamps[key];
    if (timestamp == null) return null;
    
    final expiry = timestamp.add(_defaultCacheExpiry);
    final now = DateTime.now();
    
    if (now.isAfter(expiry)) return Duration.zero;
    return expiry.difference(now);
  }

  /// Check if key is expired
  static bool _isExpired(String key) {
    final timestamp = _cacheTimestamps[key];
    if (timestamp == null) return true;
    
    final expiry = timestamp.add(_defaultCacheExpiry);
    return DateTime.now().isAfter(expiry);
  }

  /// Clean up expired entries
  static void cleanupExpired() {
    final expiredKeys = <String>[];
    
    for (final key in _memoryCache.keys) {
      if (_isExpired(key)) {
        expiredKeys.add(key);
      }
    }
    
    removeMultiple(expiredKeys);
  }

  /// Schedule periodic cleanup
  static Timer scheduleCleanup({Duration interval = const Duration(minutes: 30)}) {
    return Timer.periodic(interval, (_) => cleanupExpired());
  }

  /// Export cache to JSON
  static Map<String, dynamic> exportToJson() {
    return {
      'cache': Map.from(_memoryCache),
      'timestamps': _cacheTimestamps.map(
        (key, value) => MapEntry(key, value.millisecondsSinceEpoch),
      ),
    };
  }

  /// Import cache from JSON
  static void importFromJson(Map<String, dynamic> data) {
    clear();
    
    final cache = data['cache'] as Map<String, dynamic>?;
    final timestamps = data['timestamps'] as Map<String, dynamic>?;
    
    if (cache != null) {
      _memoryCache.addAll(cache);
    }
    
    if (timestamps != null) {
      for (final entry in timestamps.entries) {
        _cacheTimestamps[entry.key] = 
            DateTime.fromMillisecondsSinceEpoch(entry.value as int);
      }
    }
  }

  /// Create a scoped cache namespace
  static ScopedCache createScope(String namespace) {
    return ScopedCache(namespace);
  }
}

/// Scoped cache for namespace isolation
class ScopedCache {
  final String namespace;
  
  ScopedCache(this.namespace);
  
  String _scopedKey(String key) => '$namespace:$key';
  
  T? get<T>(String key) => CacheOperations.get<T>(_scopedKey(key));
  
  void set<T>(String key, T value, {Duration? expiry}) =>
      CacheOperations.set(_scopedKey(key), value, expiry: expiry);
  
  void remove(String key) => CacheOperations.remove(_scopedKey(key));
  
  bool contains(String key) => CacheOperations.contains(_scopedKey(key));
  
  void clear() {
    final pattern = RegExp('^$namespace:');
    CacheOperations.removeKeysMatching(pattern);
  }
  
  List<String> getKeys() {
    final pattern = RegExp('^$namespace:');
    return CacheOperations.getKeysMatching(pattern)
        .map((key) => key.substring(namespace.length + 1))
        .toList();
  }
}
