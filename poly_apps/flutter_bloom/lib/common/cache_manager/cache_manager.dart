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
import 'dart:collection';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:crypto/crypto.dart';
import '../storage_tools/storage_manager.dart';
import '../network/core/network_types.dart';

/// Enhanced cache entry with network response integration
class CacheEntry<T> {
  final T data;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final String? etag;
  final Map<String, dynamic>? metadata;
  final String? cacheKey;
  final CacheStrategy strategy;
  final List<String> tags;
  int accessCount;
  DateTime lastAccessed;
  final Duration? latency;
  final bool isFromNetwork;

  CacheEntry({
    required this.data,
    required this.createdAt,
    this.expiresAt,
    this.etag,
    this.metadata,
    this.cacheKey,
    this.strategy = CacheStrategy.cacheFirst,
    this.tags = const [],
    this.accessCount = 0,
    DateTime? lastAccessed,
    this.latency,
    this.isFromNetwork = false,
  }) : lastAccessed = lastAccessed ?? createdAt;

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  bool get isStale {
    if (expiresAt == null) return false;
    final staleDuration = Duration(minutes: 5);
    return DateTime.now().isAfter(expiresAt!.subtract(staleDuration));
  }

  Duration? get timeToExpiry {
    if (expiresAt == null) return null;
    final now = DateTime.now();
    if (now.isAfter(expiresAt!)) return Duration.zero;
    return expiresAt!.difference(now);
  }

  Duration get age => DateTime.now().difference(createdAt);

  int get estimatedSize {
    try {
      return utf8.encode(jsonEncode(data)).length;
    } catch (e) {
      return 1024; // Default estimate
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'data': data,
      'createdAt': createdAt.toIso8601String(),
      'expiresAt': expiresAt?.toIso8601String(),
      'etag': etag,
      'metadata': metadata,
      'cacheKey': cacheKey,
      'strategy': strategy.index,
      'tags': tags,
      'accessCount': accessCount,
      'lastAccessed': lastAccessed.toIso8601String(),
      'latency': latency?.inMilliseconds,
      'isFromNetwork': isFromNetwork,
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
      cacheKey: json['cacheKey'],
      strategy: json['strategy'] != null
          ? CacheStrategy.values[json['strategy']]
          : CacheStrategy.cacheFirst,
      tags: List<String>.from(json['tags'] ?? []),
      accessCount: json['accessCount'] ?? 0,
      lastAccessed: json['lastAccessed'] != null
          ? DateTime.parse(json['lastAccessed'])
          : DateTime.now(),
      latency: json['latency'] != null
          ? Duration(milliseconds: json['latency'])
          : null,
      isFromNetwork: json['isFromNetwork'] ?? false,
    );
  }

  /// Create from NetworkResponse
  static CacheEntry<T> fromNetworkResponse<T>(
    NetworkResponse<T> response,
    String cacheKey,
    {Duration? customTtl,
     CacheStrategy? strategy,
     List<String>? tags}
  ) {
    final now = DateTime.now();
    final ttl = customTtl ?? Duration(minutes: 5);

    return CacheEntry<T>(
      data: response.data as T,
      createdAt: response.timestamp,
      expiresAt: now.add(ttl),
      etag: response.headers?['etag'],
      metadata: response.metadata,
      cacheKey: cacheKey,
      strategy: strategy ?? CacheStrategy.cacheFirst,
      tags: tags ?? [],
      accessCount: 0,
      lastAccessed: now,
      latency: response.latency,
      isFromNetwork: true,
    );
  }

  /// Convert to NetworkResponse
  NetworkResponse<T> toNetworkResponse() {
    return NetworkResponse<T>(
      data: data,
      statusCode: 200,
      message: 'Retrieved from cache',
      headers: etag != null ? {'etag': etag!} : null,
      isFromCache: true,
      isStale: isStale,
      timestamp: createdAt,
      latency: latency,
      metadata: metadata,
    );
  }
}

/// Enhanced cache configuration with network support
class CacheConfig {
  final Duration? defaultTtl;
  final int? maxSize;
  final bool persistToDisk;
  final String? customBoxName;
  final CacheStrategy defaultStrategy;
  final bool enableCompression;
  final bool enableEncryption;
  final Duration staleWhileRevalidateWindow;
  final int maxMemorySize;
  final double compressionThreshold;
  final List<String> defaultTags;

  const CacheConfig({
    this.defaultTtl,
    this.maxSize,
    this.persistToDisk = true,
    this.customBoxName,
    this.defaultStrategy = CacheStrategy.cacheFirst,
    this.enableCompression = false,
    this.enableEncryption = false,
    this.staleWhileRevalidateWindow = const Duration(minutes: 5),
    this.maxMemorySize = 50,
    this.compressionThreshold = 1024.0,
    this.defaultTags = const [],
  });

  CacheConfig copyWith({
    Duration? defaultTtl,
    int? maxSize,
    bool? persistToDisk,
    String? customBoxName,
    CacheStrategy? defaultStrategy,
    bool? enableCompression,
    bool? enableEncryption,
    Duration? staleWhileRevalidateWindow,
    int? maxMemorySize,
    double? compressionThreshold,
    List<String>? defaultTags,
  }) {
    return CacheConfig(
      defaultTtl: defaultTtl ?? this.defaultTtl,
      maxSize: maxSize ?? this.maxSize,
      persistToDisk: persistToDisk ?? this.persistToDisk,
      customBoxName: customBoxName ?? this.customBoxName,
      defaultStrategy: defaultStrategy ?? this.defaultStrategy,
      enableCompression: enableCompression ?? this.enableCompression,
      enableEncryption: enableEncryption ?? this.enableEncryption,
      staleWhileRevalidateWindow: staleWhileRevalidateWindow ?? this.staleWhileRevalidateWindow,
      maxMemorySize: maxMemorySize ?? this.maxMemorySize,
      compressionThreshold: compressionThreshold ?? this.compressionThreshold,
      defaultTags: defaultTags ?? this.defaultTags,
    );
  }
}

/// Cache invalidation strategies
enum CacheInvalidationStrategy {
  manual,
  timeBasedOnly,
  etagBased,
  mixed,
}

/// Unified multi-level cache manager with network integration
class CacheManager {
  static CacheManager? _instance;
  static CacheManager get instance => _instance ??= CacheManager._internal();

  CacheManager._internal();

  // Memory cache with LRU eviction
  final LinkedHashMap<String, Map<String, CacheEntry<dynamic>>> _memoryCache = LinkedHashMap();
  final Map<String, CacheConfig> _cacheConfigs = {};
  final Map<String, Timer> _cleanupTimers = {};
  final StorageManager _storage = StorageManager.instance;

  // Network cache specific
  final Map<String, Future<dynamic>> _pendingRequests = {};
  final Map<String, int> _hitCounts = {};
  final Map<String, int> _missCounts = {};
  final Map<String, Duration> _averageLatencies = {};

  // Performance monitoring
  Timer? _metricsTimer;
  int _totalRequests = 0;
  int _totalHits = 0;

  static const String _defaultBoxName = 'app_cache';
  static const String _networkCacheBoxName = 'network_cache';
  static const Duration _defaultCleanupInterval = Duration(minutes: 30);
  static const Duration _metricsInterval = Duration(minutes: 5);

  /// Initialize cache manager with network support
  Future<void> initialize() async {
    await _storage.init();
    await _storage.openBox(_defaultBoxName);
    await _storage.openBox(_networkCacheBoxName);
    _scheduleCleanup();
    _scheduleMetricsCollection();

    // Register default network cache config
    registerCacheConfig('network', const CacheConfig(
      defaultTtl: Duration(minutes: 5),
      maxSize: 200,
      customBoxName: _networkCacheBoxName,
      defaultStrategy: CacheStrategy.cacheFirst,
      enableCompression: true,
      maxMemorySize: 100,
    ));

    if (kDebugMode) {
      print('🚀 Unified Cache Manager initialized with network support');
    }
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

  /// Network-specific cache methods

  /// Store NetworkResponse in cache
  Future<void> storeNetworkResponse<T>(
    String cacheKey,
    NetworkResponse<T> response, {
    Duration? ttl,
    CacheStrategy? strategy,
    List<String>? tags,
  }) async {
    if (response.data == null) return;

    final entry = CacheEntry.fromNetworkResponse(
      response,
      cacheKey,
      customTtl: ttl,
      strategy: strategy,
      tags: tags,
    );

    await put('network', cacheKey, response.data as T,
        ttl: ttl,
        metadata: {
          'statusCode': response.statusCode,
          'headers': response.headers,
          'isFromNetwork': true,
          'latency': response.latency?.inMilliseconds,
        });
  }

  /// Get NetworkResponse from cache
  Future<NetworkResponse<T>?> getNetworkResponse<T>(String cacheKey) async {
    final entry = await getEntry('network', cacheKey);
    if (entry == null) {
      _recordCacheMiss(cacheKey);
      return null;
    }

    _recordCacheHit(cacheKey);

    // Convert cache entry to NetworkResponse
    return NetworkResponse<T>(
      data: entry.data as T,
      statusCode: entry.metadata?['statusCode'] ?? 200,
      message: 'Retrieved from cache',
      headers: entry.metadata?['headers'],
      isFromCache: true,
      isStale: entry.isExpired,
      timestamp: entry.createdAt,
      latency: entry.metadata?['latency'] != null
          ? Duration(milliseconds: entry.metadata!['latency'])
          : null,
      metadata: entry.metadata,
    );
  }

  /// Cache-first strategy implementation
  Future<NetworkResponse<T>> executeWithCacheFirst<T>(
    String cacheKey,
    Future<NetworkResponse<T>> Function() networkRequest, {
    Duration? staleTime,
    bool allowStaleOnError = true,
  }) async {
    // Step 1: Try to get from cache
    final cachedResponse = await getNetworkResponse<T>(cacheKey);
    if (cachedResponse != null) {
      final isStale = staleTime != null &&
          DateTime.now().difference(cachedResponse.timestamp) > staleTime;

      if (!isStale) {
        if (kDebugMode) {
          print('Cache hit (fresh): $cacheKey');
        }
        return cachedResponse.copyWith(isFromCache: true);
      }

      // Cache is stale, try network but keep stale as fallback
      if (kDebugMode) {
        print('Cache hit (stale): $cacheKey, trying network...');
      }

      try {
        final networkResponse = await networkRequest();
        await storeNetworkResponse(cacheKey, networkResponse);
        return networkResponse;
      } catch (e) {
        if (allowStaleOnError) {
          if (kDebugMode) {
            print('Network failed, returning stale cache: $cacheKey');
          }
          return cachedResponse.copyWith(
            isFromCache: true,
            isStale: true,
            error: 'Network error: $e',
          );
        }
        rethrow;
      }
    }

    // Step 2: No cache, try network
    try {
      final networkResponse = await networkRequest();
      await storeNetworkResponse(cacheKey, networkResponse);
      return networkResponse;
    } catch (e) {
      if (kDebugMode) {
        print('Cache miss and network failed: $cacheKey');
      }
      rethrow;
    }
  }

  /// Request deduplication for identical network requests
  Future<T> deduplicate<T>(
    String key,
    Future<T> Function() request,
  ) async {
    if (_pendingRequests.containsKey(key)) {
      return await _pendingRequests[key] as T;
    }

    final future = request();
    _pendingRequests[key] = future;

    try {
      final result = await future;
      return result;
    } finally {
      _pendingRequests.remove(key);
    }
  }

  /// Invalidate cache by tags (useful for related data)
  Future<void> invalidateByTags(List<String> tags) async {
    final keysToInvalidate = <String>[];

    // Check memory cache
    for (final cacheTypeEntry in _memoryCache.entries) {
      for (final cacheEntry in cacheTypeEntry.value.entries) {
        final entry = cacheEntry.value;
        if (entry.tags.any((tag) => tags.contains(tag))) {
          keysToInvalidate.add('${cacheTypeEntry.key}:${cacheEntry.key}');
        }
      }
    }

    // Remove found entries
    for (final key in keysToInvalidate) {
      final parts = key.split(':');
      if (parts.length >= 2) {
        final cacheType = parts[0];
        final cacheKey = parts.sublist(1).join(':');
        await remove(cacheType, cacheKey);
      }
    }

    if (kDebugMode) {
      print('🗑️ Invalidated ${keysToInvalidate.length} entries by tags: $tags');
    }
  }

  /// Invalidate cache by pattern
  Future<void> invalidateByPattern(String pattern) async {
    final regex = RegExp(pattern);
    final keysToInvalidate = <String>[];

    // Check memory cache
    for (final cacheTypeEntry in _memoryCache.entries) {
      for (final cacheEntry in cacheTypeEntry.value.entries) {
        if (regex.hasMatch(cacheEntry.key)) {
          keysToInvalidate.add('${cacheTypeEntry.key}:${cacheEntry.key}');
        }
      }
    }

    // Remove found entries
    for (final key in keysToInvalidate) {
      final parts = key.split(':');
      if (parts.length >= 2) {
        final cacheType = parts[0];
        final cacheKey = parts.sublist(1).join(':');
        await remove(cacheType, cacheKey);
      }
    }

    if (kDebugMode) {
      print('🗑️ Invalidated ${keysToInvalidate.length} entries by pattern: $pattern');
    }
  }

  /// Get comprehensive cache statistics including network metrics
  Future<Map<String, dynamic>> getDetailedStats() async {
    final basicStats = await getStats();
    final hitRate = _totalRequests > 0 ? (_totalHits / _totalRequests * 100) : 0.0;

    return {
      ...basicStats,
      'network': {
        'totalRequests': _totalRequests,
        'totalHits': _totalHits,
        'hitRate': hitRate,
        'pendingRequests': _pendingRequests.length,
        'averageLatency': _calculateAverageLatency(),
      },
      'performance': {
        'memoryPressure': _calculateMemoryPressure(),
        'diskUtilization': await _calculateDiskUtilization(),
        'cacheEfficiency': _calculateCacheEfficiency(),
      },
    };
  }

  /// Preload critical network responses
  Future<void> preloadNetworkData(Map<String, Future<NetworkResponse> Function()> loaders) async {
    final futures = <Future<void>>[];

    for (final entry in loaders.entries) {
      futures.add(_preloadSingle(entry.key, entry.value));
    }

    await Future.wait(futures);
    if (kDebugMode) {
      print('📦 Preloaded ${loaders.length} network cache entries');
    }
  }

  // Private helper methods for network cache

  void _recordCacheHit(String key) {
    _totalRequests++;
    _totalHits++;
    _hitCounts[key] = (_hitCounts[key] ?? 0) + 1;
  }

  void _recordCacheMiss(String key) {
    _totalRequests++;
    _missCounts[key] = (_missCounts[key] ?? 0) + 1;
  }

  void _scheduleMetricsCollection() {
    _metricsTimer = Timer.periodic(_metricsInterval, (_) {
      _collectMetrics();
    });
  }

  void _collectMetrics() {
    if (kDebugMode) {
      final hitRate = _totalRequests > 0 ? (_totalHits / _totalRequests * 100) : 0.0;
      print('📊 Cache Metrics: $_totalRequests requests, ${hitRate.toStringAsFixed(1)}% hit rate');
    }
  }

  Duration _calculateAverageLatency() {
    if (_averageLatencies.isEmpty) return Duration.zero;
    final total = _averageLatencies.values.fold<int>(0, (sum, duration) => sum + duration.inMilliseconds);
    return Duration(milliseconds: total ~/ _averageLatencies.length);
  }

  double _calculateMemoryPressure() {
    int totalEntries = 0;
    int maxEntries = 0;

    for (final cacheType in _memoryCache.keys) {
      final config = _cacheConfigs[cacheType] ?? const CacheConfig();
      totalEntries += _memoryCache[cacheType]?.length ?? 0;
      maxEntries += config.maxMemorySize;
    }

    return maxEntries > 0 ? (totalEntries / maxEntries) : 0.0;
  }

  Future<double> _calculateDiskUtilization() async {
    try {
      // Simple estimation based on number of cache entries
      final keys = await _storage.getKeys(_defaultBoxName);
      const estimatedSizePerEntry = 1024; // 1KB per entry estimate
      final totalSize = keys.length * estimatedSizePerEntry;
      const maxSize = 100 * 1024 * 1024; // 100MB default limit
      return totalSize / maxSize;
    } catch (e) {
      return 0.0;
    }
  }

  double _calculateCacheEfficiency() {
    if (_totalRequests == 0) return 0.0;
    return (_totalHits / _totalRequests) * 100;
  }

  Future<void> _preloadSingle(String key, Future<NetworkResponse> Function() loader) async {
    try {
      final response = await loader();
      await storeNetworkResponse(key, response);
    } catch (error) {
      if (kDebugMode) {
        print('❌ Failed to preload network cache for key $key: $error');
      }
    }
  }

  /// Generate secure cache key for network requests
  String generateCacheKey(NetworkRequest request) {
    final buffer = StringBuffer();
    buffer.write(request.methodString);
    buffer.write('|');
    buffer.write(request.endpoint);

    if (request.parameters != null && request.parameters!.isNotEmpty) {
      final sortedKeys = request.parameters!.keys.toList()..sort();
      buffer.write('|');
      for (final key in sortedKeys) {
        buffer.write('$key=${request.parameters![key]}&');
      }
    }

    // Create secure hash
    final bytes = utf8.encode(buffer.toString());
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Dispose cache manager
  void dispose() {
    for (final timer in _cleanupTimers.values) {
      timer.cancel();
    }
    _cleanupTimers.clear();
    _metricsTimer?.cancel();
    _memoryCache.clear();
    _pendingRequests.clear();
    _hitCounts.clear();
    _missCounts.clear();
    _averageLatencies.clear();
  }
}