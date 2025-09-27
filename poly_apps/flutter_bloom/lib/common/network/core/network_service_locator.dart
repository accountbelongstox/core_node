import 'dart:async';
import 'package:flutter/foundation.dart';
import 'unified_network_client.dart';
import 'network_retry_manager.dart';
import 'network_queue_and_offline.dart';
import 'network_cache_manager.dart';

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

    final effectiveConfig = config ?? NetworkConfig.defaultConfig();

    // Register factories for core services
    registerFactory<NetworkCacheManager>(() => NetworkCacheManager(
      maxMemoryCacheSize: effectiveConfig.maxCacheSize,
      defaultCacheDuration: effectiveConfig.defaultCacheDuration,
    ));

    registerFactory<NetworkRetryManager>(() => NetworkRetryManager());

    registerFactory<NetworkRequestQueue>(() => NetworkRequestQueue());

    registerFactory<OfflineRequestManager>(() => OfflineRequestManager());

    registerFactory<ConnectivityMonitor>(() => ConnectivityMonitor());

    registerFactory<RobustNetworkClient>(() => RobustNetworkClient(
      retryManager: get<NetworkRetryManager>(),
      requestQueue: get<NetworkRequestQueue>(),
      offlineManager: get<OfflineRequestManager>(),
      cacheManager: get<NetworkCacheManager>(),
      connectivityMonitor: get<ConnectivityMonitor>(),
    ));

    // Initialize connectivity monitor
    await get<ConnectivityMonitor>().initialize();

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

  /// Get the main network client
  static RobustNetworkClient get client {
    return getService<RobustNetworkClient>();
  }

  /// Get cache manager
  static NetworkCacheManager get cache {
    return getService<NetworkCacheManager>();
  }

  /// Get queue statistics
  static QueueStats get queueStats {
    return getService<NetworkRequestQueue>().getStats();
  }

  /// Get cache statistics
  static CacheStats get cacheStats {
    return getService<NetworkCacheManager>().getStats();
  }

  /// Get offline statistics
  static OfflineStats get offlineStats {
    return getService<OfflineRequestManager>().getStats();
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