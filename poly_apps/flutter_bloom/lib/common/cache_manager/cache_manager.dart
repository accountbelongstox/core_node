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
import 'package:flutter/foundation.dart';
import '../storage/storage_manager.dart';

/// Cache entry with expiration and metadata
class CacheEntry<T> {
  final T data;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final String? etag;
  final Map<String, dynamic>? metadata;

  CacheEntry({
    required this.data,
    required this.createdAt,
    this.expiresAt,
    this.etag,
    this.metadata,
  });

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  Duration? get timeToExpiry {
    if (expiresAt == null) return null;
    final now = DateTime.now();
    if (now.isAfter(expiresAt!)) return Duration.zero;
    return expiresAt!.difference(now);
  }

  Map<String, dynamic> toJson() {
    return {
      'data': data,
      'createdAt': createdAt.toIso8601String(),
      'expiresAt': expiresAt?.toIso8601String(),
      'etag': etag,
      'metadata': metadata,
    };
  }

  static CacheEntry<T> fromJson<T>(
    Map<String, dynamic> json,
    T Function(dynamic) fromJsonT,
  ) {
    return CacheEntry<T>(
      data: fromJsonT(json['data']),
      createdAt: DateTime.parse(json['createdAt']),
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'])
          : null,
      etag: json['etag'],
      metadata: json['metadata'],
    );
  }
}

/// Cache configuration for different cache types
class CacheConfig {
  final Duration? defaultTtl;
  final int? maxSize;
  final bool persistToDisk;
  final String? customBoxName;

  const CacheConfig({
    this.defaultTtl,
    this.maxSize,
    this.persistToDisk = true,
    this.customBoxName,
  });
}

/// Cache invalidation strategies
enum CacheInvalidationStrategy {
  manual,
  timeBasedOnly,
  etagBased,
  mixed,
}

/// Multi-level cache manager with memory and persistent storage
class CacheManager {
  static CacheManager? _instance;
  static CacheManager get instance => _instance ??= CacheManager._internal();

  CacheManager._internal();

  final Map<String, Map<String, CacheEntry<dynamic>>> _memoryCache = {};
  final Map<String, CacheConfig> _cacheConfigs = {};
  final Map<String, Timer> _cleanupTimers = {};
  final StorageManager _storage = StorageManager.instance;

  static const String _defaultBoxName = 'app_cache';
  static const Duration _defaultCleanupInterval = Duration(minutes: 30);

  /// Initialize cache manager
  Future<void> initialize() async {
    await _storage.init();
    await _storage.openBox(_defaultBoxName);
    _scheduleCleanup();
  }

  /// Register cache configuration for a specific cache type
  void registerCacheConfig(String cacheType, CacheConfig config) {
    _cacheConfigs[cacheType] = config;

    if (config.persistToDisk && config.customBoxName != null) {
      _storage.openBox(config.customBoxName!);
    }
  }

  /// Put item in cache with TTL
  Future<void> put<T>(
    String cacheType,
    String key,
    T data, {
    Duration? ttl,
    String? etag,
    Map<String, dynamic>? metadata,
  }) async {
    final config = _cacheConfigs[cacheType] ?? const CacheConfig();
    final effectiveTtl = ttl ?? config.defaultTtl;

    final entry = CacheEntry<T>(
      data: data,
      createdAt: DateTime.now(),
      expiresAt: effectiveTtl != null
          ? DateTime.now().add(effectiveTtl)
          : null,
      etag: etag,
      metadata: metadata,
    );

    // Store in memory cache
    _memoryCache[cacheType] ??= {};
    _memoryCache[cacheType]![key] = entry;

    // Enforce memory cache size limits
    _enforceMemoryCacheSize(cacheType, config);

    // Store in persistent cache if enabled
    if (config.persistToDisk) {
      final boxName = config.customBoxName ?? _defaultBoxName;
      final cacheKey = '$cacheType:$key';
      await _storage.putValue(boxName, cacheKey, entry.toJson());
    }

    if (kDebugMode) {
      print('Cache PUT: $cacheType:$key${effectiveTtl != null ? ' (TTL: ${effectiveTtl.inSeconds}s)' : ' (No TTL)'}');
    }
  }

  /// Get item from cache
  Future<T?> get<T>(
    String cacheType,
    String key, {
    T Function(dynamic)? fromJson,
  }) async {
    // Check memory cache first
    final memoryEntry = _memoryCache[cacheType]?[key];
    if (memoryEntry != null) {
      if (!memoryEntry.isExpired) {
        if (kDebugMode) {
          print('Cache HIT (memory): $cacheType:$key');
        }
        return memoryEntry.data as T?;
      } else {
        // Remove expired entry from memory
        _memoryCache[cacheType]?.remove(key);
      }
    }

    // Check persistent cache
    final config = _cacheConfigs[cacheType] ?? const CacheConfig();
    if (config.persistToDisk) {
      final boxName = config.customBoxName ?? _defaultBoxName;
      final cacheKey = '$cacheType:$key';

      final persistentData = await _storage.getValue<Map<String, dynamic>>(
        boxName,
        cacheKey,
      );

      if (persistentData != null) {
        try {
          final entry = CacheEntry.fromJson<dynamic>(
            persistentData,
            (data) => data,
          );

          if (!entry.isExpired) {
            // Restore to memory cache
            _memoryCache[cacheType] ??= {};
            _memoryCache[cacheType]![key] = entry;

            if (kDebugMode) {
              print('Cache HIT (persistent): $cacheType:$key');
            }
            return entry.data as T?;
          } else {
            // Remove expired entry from persistent storage
            await _storage.deleteKey(boxName, cacheKey);
          }
        } catch (e) {
          if (kDebugMode) {
            print('Error deserializing cache entry: $e');
          }
        }
      }
    }

    if (kDebugMode) {
      print('Cache MISS: $cacheType:$key');
    }
    return null;
  }

  /// Check if cache has valid entry
  Future<bool> has(String cacheType, String key) async {
    final entry = await get<dynamic>(cacheType, key);
    return entry != null;
  }

  /// Remove specific cache entry
  Future<void> remove(String cacheType, String key) async {
    // Remove from memory
    _memoryCache[cacheType]?.remove(key);

    // Remove from persistent storage
    final config = _cacheConfigs[cacheType] ?? const CacheConfig();
    if (config.persistToDisk) {
      final boxName = config.customBoxName ?? _defaultBoxName;
      final cacheKey = '$cacheType:$key';
      await _storage.deleteKey(boxName, cacheKey);
    }

    if (kDebugMode) {
      print('Cache REMOVE: $cacheType:$key');
    }
  }

  /// Clear all entries for a cache type
  Future<void> clear(String cacheType) async {
    // Clear memory cache
    _memoryCache.remove(cacheType);

    // Clear persistent cache
    final config = _cacheConfigs[cacheType] ?? const CacheConfig();
    if (config.persistToDisk) {
      final boxName = config.customBoxName ?? _defaultBoxName;
      final keys = await _storage.getKeys(boxName);
      final cacheKeys = keys.where((key) => key.toString().startsWith('$cacheType:'));

      for (final key in cacheKeys) {
        await _storage.deleteKey(boxName, key.toString());
      }
    }

    if (kDebugMode) {
      print('Cache CLEAR: $cacheType');
    }
  }

  /// Clear all caches
  Future<void> clearAll() async {
    _memoryCache.clear();
    await _storage.clearBox(_defaultBoxName);

    for (final config in _cacheConfigs.values) {
      if (config.customBoxName != null) {
        await _storage.clearBox(config.customBoxName!);
      }
    }

    if (kDebugMode) {
      print('Cache CLEAR ALL');
    }
  }

  /// Get cache entry metadata
  Future<CacheEntry<dynamic>?> getEntry(String cacheType, String key) async {
    // Check memory cache first
    final memoryEntry = _memoryCache[cacheType]?[key];
    if (memoryEntry != null && !memoryEntry.isExpired) {
      return memoryEntry;
    }

    // Check persistent cache
    final config = _cacheConfigs[cacheType] ?? const CacheConfig();
    if (config.persistToDisk) {
      final boxName = config.customBoxName ?? _defaultBoxName;
      final cacheKey = '$cacheType:$key';

      final persistentData = await _storage.getValue<Map<String, dynamic>>(
        boxName,
        cacheKey,
      );

      if (persistentData != null) {
        try {
          final entry = CacheEntry.fromJson<dynamic>(
            persistentData,
            (data) => data,
          );

          if (!entry.isExpired) {
            return entry;
          }
        } catch (e) {
          if (kDebugMode) {
            print('Error deserializing cache entry metadata: $e');
          }
        }
      }
    }

    return null;
  }

  /// Get cache statistics
  Future<Map<String, dynamic>> getStats() async {
    int memoryEntries = 0;
    int persistentEntries = 0;
    int expiredEntries = 0;

    // Count memory entries
    for (final cache in _memoryCache.values) {
      for (final entry in cache.values) {
        memoryEntries++;
        if (entry.isExpired) expiredEntries++;
      }
    }

    // Count persistent entries (approximate)
    final keys = await _storage.getKeys(_defaultBoxName);
    persistentEntries = keys.length;

    return {
      'memoryEntries': memoryEntries,
      'persistentEntries': persistentEntries,
      'expiredEntries': expiredEntries,
      'cacheTypes': _cacheConfigs.keys.toList(),
      'lastCleanup': DateTime.now().toIso8601String(),
    };
  }

  /// Cleanup expired entries
  Future<void> cleanup() async {
    int cleanedMemory = 0;
    int cleanedPersistent = 0;

    // Cleanup memory cache
    for (final cacheType in _memoryCache.keys.toList()) {
      final cache = _memoryCache[cacheType]!;
      final keysToRemove = <String>[];

      for (final entry in cache.entries) {
        if (entry.value.isExpired) {
          keysToRemove.add(entry.key);
        }
      }

      for (final key in keysToRemove) {
        cache.remove(key);
        cleanedMemory++;
      }

      if (cache.isEmpty) {
        _memoryCache.remove(cacheType);
      }
    }

    // Cleanup persistent cache
    final keys = await _storage.getKeys(_defaultBoxName);
    for (final key in keys) {
      try {
        final data = await _storage.getValue<Map<String, dynamic>>(
          _defaultBoxName,
          key.toString(),
        );

        if (data != null) {
          final entry = CacheEntry.fromJson<dynamic>(
            data,
            (data) => data,
          );

          if (entry.isExpired) {
            await _storage.deleteKey(_defaultBoxName, key.toString());
            cleanedPersistent++;
          }
        }
      } catch (e) {
        // Remove corrupted entries
        await _storage.deleteKey(_defaultBoxName, key.toString());
        cleanedPersistent++;
      }
    }

    if (kDebugMode) {
      print('Cache cleanup completed: $cleanedMemory memory, $cleanedPersistent persistent entries removed');
    }
  }

  void _enforceMemoryCacheSize(String cacheType, CacheConfig config) {
    if (config.maxSize == null) return;

    final cache = _memoryCache[cacheType]!;
    if (cache.length <= config.maxSize!) return;

    // Remove oldest entries first
    final entries = cache.entries.toList()
      ..sort((a, b) => a.value.createdAt.compareTo(b.value.createdAt));

    final entriesToRemove = entries.length - config.maxSize!;
    for (int i = 0; i < entriesToRemove; i++) {
      cache.remove(entries[i].key);
    }

    if (kDebugMode) {
      print('Cache size enforced for $cacheType: removed $entriesToRemove entries');
    }
  }

  void _scheduleCleanup() {
    Timer.periodic(_defaultCleanupInterval, (timer) {
      cleanup();
    });
  }

  /// Dispose cache manager
  void dispose() {
    for (final timer in _cleanupTimers.values) {
      timer.cancel();
    }
    _cleanupTimers.clear();
    _memoryCache.clear();
  }
}