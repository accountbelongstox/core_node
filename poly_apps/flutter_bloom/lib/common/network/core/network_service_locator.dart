import 'dart:async';
import 'package:flutter/foundation.dart';
import 'unified_network_client.dart';
// FIXED: Added 'as retry' prefix to resolve ConnectivityMonitor naming conflict
import 'network_retry_manager.dart' as retry;
// FIXED: Added 'as queue' prefix to resolve QueueStats and OfflineStats naming conflicts
import 'network_queue_and_offline.dart' as queue;
// FIXED: Added 'as cache' prefix to resolve CacheManager naming conflict
import '../../cache_manager/cache_manager.dart' as cache;
import 'network_types.dart';

/// Network Service Locator
/// Replaces problematic singleton pattern with proper dependency injection
class NetworkServiceLocator {
  static NetworkServiceLocator? _instance;
  static NetworkServiceLocator get instance => _instance ??= NetworkServiceLocator._();
  NetworkServiceLocator._();

  final Map<Type, dynamic> _services = {};
  final Map<Type, dynamic Function()> _factories = {};
  bool _isInitialized = false;

  /// Initialize the service locator with default services
  Future<void> initialize({
    NetworkConfig? config,
  }) async {
    if (_isInitialized) {
      debugPrint('NetworkServiceLocator already initialized');
      return;
    }

    // FIXED: Removed unused effectiveConfig variable as configuration is not currently used
    // TODO: Pass config to services that need configuration in the future

    // FIXED: NetworkCacheManager doesn't exist, use CacheManager from cache_manager.dart
    // Register factories for core services
    registerFactory<cache.CacheManager>(() => cache.CacheManager.instance);

    // FIXED: NetworkRetryManager -> retry.NetworkRetryManager for clarity
    registerFactory<retry.NetworkRetryManager>(() => retry.NetworkRetryManager());

    // FIXED: NetworkRequestQueue -> queue.NetworkRequestQueue for clarity
    registerFactory<queue.NetworkRequestQueue>(() => queue.NetworkRequestQueue());

    // FIXED: OfflineRequestManager -> queue.OfflineRequestManager for clarity
    registerFactory<queue.OfflineRequestManager>(() => queue.OfflineRequestManager());

    // FIXED: ConnectivityMonitor exists in retry manager, use retry.ConnectivityMonitor
    registerFactory<retry.ConnectivityMonitor>(() => retry.ConnectivityMonitor());

    // REFACTOR: UnifiedNetworkClient requires ApiConfig - register as factory with config
    // Note: Services should create their own instances with proper config
    // This is kept for backward compatibility but not recommended

    // Initialize connectivity monitor
    // FIXED: Use retry.ConnectivityMonitor for correct type reference
    await get<retry.ConnectivityMonitor>().initialize();

    _isInitialized = true;
    debugPrint('NetworkServiceLocator initialized successfully');
  }

  /// Register a factory function for a service type
  void registerFactory<T>(T Function() factory) {
    _factories[T] = factory;
    debugPrint('Registered factory for ${T.toString()}');
  }

  /// Register a singleton instance
  void registerSingleton<T>(T instance) {
    _services[T] = instance;
    debugPrint('Registered singleton for ${T.toString()}');
  }

  /// Get service instance
  T get<T>() {
    // Try to get existing instance first
    if (_services.containsKey(T)) {
      return _services[T] as T;
    }

    // Try to create from factory
    final factory = _factories[T];
    if (factory != null) {
      final instance = factory() as T;
      _services[T] = instance; // Cache as singleton
      return instance;
    }

    throw ServiceNotRegisteredException('Service not registered: ${T.toString()}');
  }

  /// Check if service is registered
  bool isRegistered<T>() {
    return _services.containsKey(T) || _factories.containsKey(T);
  }

  /// Reset a specific service (useful for testing)
  void reset<T>() {
    final instance = _services.remove(T);
    if (instance != null && instance is Disposable) {
      instance.dispose();
    }
    debugPrint('Reset service: ${T.toString()}');
  }

  /// Dispose all services and reset the locator
  Future<void> dispose() async {
    debugPrint('Disposing NetworkServiceLocator...');

    // Dispose all services that implement Disposable
    for (final service in _services.values) {
      if (service is Disposable) {
        try {
          await service.dispose();
        } catch (e) {
          debugPrint('Error disposing service: $e');
        }
      }
    }

    _services.clear();
    _factories.clear();
    _isInitialized = false;

    debugPrint('NetworkServiceLocator disposed');
  }

  /// Create a scoped service locator (useful for testing)
  NetworkServiceLocator createScope() {
    final scopedLocator = NetworkServiceLocator._();
    scopedLocator._factories.addAll(_factories);
    return scopedLocator;
  }
}

/// Base interface for disposable services
mixin Disposable {
  Future<void> dispose();
}

/// Network configuration class
class NetworkConfig {
  final String? baseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;
  final Duration sendTimeout;
  final int maxRetries;
  final Duration retryDelay;
  final List<int> retryStatusCodes;
  final bool enableCache;
  final Duration defaultCacheDuration;
  final int maxCacheSize;
  final bool enableQueue;
  final int maxConcurrentRequests;
  final bool enableOffline;
  final int maxOfflineRequests;

  const NetworkConfig({
    this.baseUrl,
    this.connectTimeout = const Duration(seconds: 10),
    this.receiveTimeout = const Duration(seconds: 30),
    this.sendTimeout = const Duration(seconds: 30),
    this.maxRetries = 3,
    this.retryDelay = const Duration(seconds: 1),
    this.retryStatusCodes = const [408, 429, 500, 502, 503, 504],
    this.enableCache = true,
    this.defaultCacheDuration = const Duration(minutes: 5),
    this.maxCacheSize = 100,
    this.enableQueue = true,
    this.maxConcurrentRequests = 3,
    this.enableOffline = true,
    this.maxOfflineRequests = 100,
  });

  factory NetworkConfig.defaultConfig() {
    return const NetworkConfig();
  }

  factory NetworkConfig.production({
    required String baseUrl,
  }) {
    return NetworkConfig(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: 15),
      receiveTimeout: Duration(seconds: 60),
      maxRetries: 2,
      maxCacheSize: 200,
      maxConcurrentRequests: 5,
    );
  }

  factory NetworkConfig.development({
    required String baseUrl,
  }) {
    return NetworkConfig(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 120),
      maxRetries: 5,
      maxCacheSize: 50,
      maxConcurrentRequests: 2,
    );
  }

  NetworkConfig copyWith({
    String? baseUrl,
    Duration? connectTimeout,
    Duration? receiveTimeout,
    Duration? sendTimeout,
    int? maxRetries,
    Duration? retryDelay,
    List<int>? retryStatusCodes,
    bool? enableCache,
    Duration? defaultCacheDuration,
    int? maxCacheSize,
    bool? enableQueue,
    int? maxConcurrentRequests,
    bool? enableOffline,
    int? maxOfflineRequests,
  }) {
    return NetworkConfig(
      baseUrl: baseUrl ?? this.baseUrl,
      connectTimeout: connectTimeout ?? this.connectTimeout,
      receiveTimeout: receiveTimeout ?? this.receiveTimeout,
      sendTimeout: sendTimeout ?? this.sendTimeout,
      maxRetries: maxRetries ?? this.maxRetries,
      retryDelay: retryDelay ?? this.retryDelay,
      retryStatusCodes: retryStatusCodes ?? this.retryStatusCodes,
      enableCache: enableCache ?? this.enableCache,
      defaultCacheDuration: defaultCacheDuration ?? this.defaultCacheDuration,
      maxCacheSize: maxCacheSize ?? this.maxCacheSize,
      enableQueue: enableQueue ?? this.enableQueue,
      maxConcurrentRequests: maxConcurrentRequests ?? this.maxConcurrentRequests,
      enableOffline: enableOffline ?? this.enableOffline,
      maxOfflineRequests: maxOfflineRequests ?? this.maxOfflineRequests,
    );
  }
}

/// Network Framework main entry point
class NetworkFramework {
  static bool get isInitialized => NetworkServiceLocator.instance._isInitialized;

  /// Initialize the network framework
  static Future<void> initialize({
    NetworkConfig? config,
  }) async {
    await NetworkServiceLocator.instance.initialize(config: config);
  }

  /// Get a service instance
  static T getService<T>() {
    return NetworkServiceLocator.instance.get<T>();
  }

  // REMOVED: Deprecated client getter
  // Services should create their own UnifiedNetworkClient instances with proper ApiConfig

  /// Get cache manager
  // FIXED: Use cache.CacheManager to resolve naming conflict
  static cache.CacheManager get cacheManager {
    return cache.CacheManager.instance;
  }

  /// Get queue statistics
  // FIXED: Use queue.QueueStats to resolve naming conflict
  static queue.QueueStats get queueStats {
    return getService<queue.NetworkRequestQueue>().getStats();
  }

  /// Get cache statistics
  // FIXED: CacheStats doesn't exist on CacheManager, removed this method
  // TODO: Implement CacheStats if needed in cache_manager.dart

  /// Get offline statistics
  // FIXED: Use queue.OfflineStats to resolve naming conflict
  static queue.OfflineStats get offlineStats {
    return getService<queue.OfflineRequestManager>().getStats();
  }

  /// Dispose the framework
  static Future<void> dispose() async {
    await NetworkServiceLocator.instance.dispose();
  }

  /// Create a scoped instance for testing
  static NetworkServiceLocator createTestScope() {
    return NetworkServiceLocator.instance.createScope();
  }
}

/// Service not registered exception
class ServiceNotRegisteredException implements Exception {
  final String message;
  const ServiceNotRegisteredException(this.message);

  @override
  String toString() => 'ServiceNotRegisteredException: $message';
}