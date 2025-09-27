/// Advanced Network Framework for Flutter Applications
/// 
/// This framework provides a comprehensive networking solution with:
/// - Multi-authentication support (JWT, Session, Client Key, Custom)
/// - Smart caching with memory and disk strategies
/// - Request queuing and priority management
/// - Automatic retry with exponential backoff
/// - Global loading state management
/// - Endpoint configuration system
/// - Auto-parsing and data validation
/// - Security features and device identification
/// - Comprehensive logging and debugging
/// 
/// Usage:
/// ```dart
/// // Initialize the framework
/// await NetworkFramework.initialize();
/// 
/// // Configure for your app
/// NetworkFramework.configure(
///   baseUrl: 'https://api.example.com',
///   authType: AuthType.jwt,
/// );
/// 
/// // Create a service
/// class MyApiService extends AdvancedNetworkService {
///   @override
///   String get serviceName => 'MyAPI';
///   
///   @override
///   EndpointConfig get endpointConfig => MyEndpointConfig();
/// }
/// 
/// // Use the service
/// final service = MyApiService();
/// final response = await service.get<UserModel>('getUser');
/// ```

library network_framework;

// Core exports
export 'core/network_config.dart';
export 'core/network_models.dart';
export 'core/network_types.dart';
export 'core/unified_network_client.dart';
export 'core/network_service_locator.dart';
export 'core/network_retry_manager.dart';
export 'core/network_queue_and_offline.dart';

// Authentication exports
export 'auth/unified_auth_manager.dart';

// Models exports
export 'models/api_response.dart';
export 'models/api_config.dart';

// Endpoints exports
export 'endpoints/endpoint_config.dart';

// Services exports
export 'services/advanced_network_service.dart';
export 'services/base_service.dart';

// Storage exports
export 'storage/secure_storage.dart';

// Interceptors exports
export 'interceptors/network_interceptors.dart';
export 'interceptors/auth_interceptor.dart';
export 'interceptors/error_interceptor.dart';
export 'interceptors/logging_interceptor.dart';

// Loading exports
export 'ui/global_loading_system.dart';

// Utils exports
export 'utils/network_utils.dart';

// Widgets exports
export 'widgets/adaptive_loading_widgets.dart';

// Parsers exports
export 'parsers/adaptive_data_parser.dart';

// Integration exports
export 'integration/network_user_integration.dart';

// Interceptor exports
export 'interceptors/network_interceptors.dart';

// Endpoint exports
export 'endpoints/endpoint_config.dart';

// Service exports
export 'services/advanced_network_service.dart';

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'core/network_config.dart';
import 'auth/auth_manager.dart';
import 'cache/cache_manager.dart';
import 'queue/request_queue.dart';
import 'loading/loading_manager.dart';
import 'client/network_client.dart';
import 'interceptors/network_interceptors.dart';
import 'storage/secure_storage.dart';

/// Main network framework class
class NetworkFramework {
  static bool _isInitialized = false;
  static final Completer<void> _initCompleter = Completer<void>();

  /// Initialize the network framework
  static Future<void> initialize({
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
    int? maxQueueSize,
    Map<String, String>? globalHeaders,
    AuthConfig? authConfig,
    bool? enableLogging,
    LogLevel? logLevel,
    bool? enableGlobalLoading,
    Duration? loadingDebounce,
    bool? enableGlobalErrorHandling,
    bool? showErrorSnackbar,
  }) async {
    if (_isInitialized) {
      return _initCompleter.future;
    }

    try {
      debugPrint('🚀 Initializing Network Framework...');

      // Update configuration if provided
      if (baseUrl != null ||
          connectTimeout != null ||
          receiveTimeout != null ||
          sendTimeout != null ||
          maxRetries != null ||
          retryDelay != null ||
          retryStatusCodes != null ||
          enableCache != null ||
          defaultCacheDuration != null ||
          maxCacheSize != null ||
          enableQueue != null ||
          maxConcurrentRequests != null ||
          maxQueueSize != null ||
          globalHeaders != null ||
          authConfig != null ||
          enableLogging != null ||
          logLevel != null ||
          enableGlobalLoading != null ||
          loadingDebounce != null ||
          enableGlobalErrorHandling != null ||
          showErrorSnackbar != null) {
        NetworkConfig.instance.updateConfig(
          baseUrl: baseUrl,
          connectTimeout: connectTimeout,
          receiveTimeout: receiveTimeout,
          sendTimeout: sendTimeout,
          maxRetries: maxRetries,
          retryDelay: retryDelay,
          retryStatusCodes: retryStatusCodes,
          enableCache: enableCache,
          defaultCacheDuration: defaultCacheDuration,
          maxCacheSize: maxCacheSize,
          enableQueue: enableQueue,
          maxConcurrentRequests: maxConcurrentRequests,
          maxQueueSize: maxQueueSize,
          globalHeaders: globalHeaders,
          authConfig: authConfig,
          enableLogging: enableLogging,
          logLevel: logLevel,
          enableGlobalLoading: enableGlobalLoading,
          loadingDebounce: loadingDebounce,
          enableGlobalErrorHandling: enableGlobalErrorHandling,
          showErrorSnackbar: showErrorSnackbar,
        );
      }

      // Initialize core components
      await SecureStorage.instance.initialize();
      await AuthManager.instance.initialize();
      await CacheManager.instance.initialize();
      RequestQueue.instance.initialize();
      await NetworkClient.instance.initialize();

      _isInitialized = true;
      _initCompleter.complete();

      debugPrint('✅ Network Framework initialized successfully');
      debugPrint('   Base URL: ${NetworkConfig.instance.baseUrl}');
      debugPrint('   Auth Type: ${NetworkConfig.instance.authConfig.authType}');
      debugPrint('   Cache Enabled: ${NetworkConfig.instance.enableCache}');
      debugPrint('   Queue Enabled: ${NetworkConfig.instance.enableQueue}');
      debugPrint('   Global Loading: ${NetworkConfig.instance.enableGlobalLoading}');

    } catch (error) {
      debugPrint('❌ Failed to initialize Network Framework: $error');
      _initCompleter.completeError(error);
      rethrow;
    }
  }

  /// Configure the network framework
  static void configure({
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
    int? maxQueueSize,
    Map<String, String>? globalHeaders,
    AuthType? authType,
    String? tokenKey,
    String? tokenPrefix,
    String? refreshTokenKey,
    String? clientIdKey,
    String? clientSecretKey,
    String? sessionKey,
    String? deviceIdKey,
    String? appSignatureKey,
    String? timestampKey,
    String? nonceKey,
    Map<String, String>? customAuthFields,
    bool? autoRefreshToken,
    Duration? tokenRefreshThreshold,
    bool? persistToken,
    String? tokenStorageKey,
    String? refreshTokenStorageKey,
    bool? enableLogging,
    LogLevel? logLevel,
    bool? enableGlobalLoading,
    Duration? loadingDebounce,
    bool? enableGlobalErrorHandling,
    bool? showErrorSnackbar,
  }) {
    // Update auth config
    final authConfig = NetworkConfig.instance.authConfig;
    if (authType != null) authConfig.authType = authType;
    if (tokenKey != null) authConfig.tokenKey = tokenKey;
    if (tokenPrefix != null) authConfig.tokenPrefix = tokenPrefix;
    if (refreshTokenKey != null) authConfig.refreshTokenKey = refreshTokenKey;
    if (clientIdKey != null) authConfig.clientIdKey = clientIdKey;
    if (clientSecretKey != null) authConfig.clientSecretKey = clientSecretKey;
    if (sessionKey != null) authConfig.sessionKey = sessionKey;
    if (deviceIdKey != null) authConfig.deviceIdKey = deviceIdKey;
    if (appSignatureKey != null) authConfig.appSignatureKey = appSignatureKey;
    if (timestampKey != null) authConfig.timestampKey = timestampKey;
    if (nonceKey != null) authConfig.nonceKey = nonceKey;
    if (customAuthFields != null) authConfig.customAuthFields.addAll(customAuthFields);
    if (autoRefreshToken != null) authConfig.autoRefreshToken = autoRefreshToken;
    if (tokenRefreshThreshold != null) authConfig.tokenRefreshThreshold = tokenRefreshThreshold;
    if (persistToken != null) authConfig.persistToken = persistToken;
    if (tokenStorageKey != null) authConfig.tokenStorageKey = tokenStorageKey;
    if (refreshTokenStorageKey != null) authConfig.refreshTokenStorageKey = refreshTokenStorageKey;

    // Update main config
    NetworkConfig.instance.updateConfig(
      baseUrl: baseUrl,
      connectTimeout: connectTimeout,
      receiveTimeout: receiveTimeout,
      sendTimeout: sendTimeout,
      maxRetries: maxRetries,
      retryDelay: retryDelay,
      retryStatusCodes: retryStatusCodes,
      enableCache: enableCache,
      defaultCacheDuration: defaultCacheDuration,
      maxCacheSize: maxCacheSize,
      enableQueue: enableQueue,
      maxConcurrentRequests: maxConcurrentRequests,
      maxQueueSize: maxQueueSize,
      globalHeaders: globalHeaders,
      authConfig: authConfig,
      enableLogging: enableLogging,
      logLevel: logLevel,
      enableGlobalLoading: enableGlobalLoading,
      loadingDebounce: loadingDebounce,
      enableGlobalErrorHandling: enableGlobalErrorHandling,
      showErrorSnackbar: showErrorSnackbar,
    );

    debugPrint('⚙️ Network Framework configured');
  }

  /// Get framework status
  static Map<String, dynamic> getStatus() {
    return {
      'isInitialized': _isInitialized,
      'config': {
        'baseUrl': NetworkConfig.instance.baseUrl,
        'authType': NetworkConfig.instance.authConfig.authType.toString(),
        'enableCache': NetworkConfig.instance.enableCache,
        'enableQueue': NetworkConfig.instance.enableQueue,
        'enableGlobalLoading': NetworkConfig.instance.enableGlobalLoading,
        'enableLogging': NetworkConfig.instance.enableLogging,
        'logLevel': NetworkConfig.instance.logLevel.toString(),
      },
      'auth': AuthManager.instance.getAuthSummary(),
    };
  }

  /// Get comprehensive statistics
  static Future<Map<String, dynamic>> getStats() async {
    if (!_isInitialized) {
      return {'error': 'Framework not initialized'};
    }

    return {
      'framework': getStatus(),
      'cache': await CacheManager.instance.getStats(),
      'queue': RequestQueue.instance.getStats(),
      'loading': LoadingManager.instance.getStats(),
      'storage': await SecureStorage.instance.getStorageStats(),
    };
  }

  /// Reset framework (for testing)
  static Future<void> reset() async {
    await AuthManager.instance.clearAuth();
    await CacheManager.instance.clear();
    RequestQueue.instance.cancelAll();
    LoadingManager.instance.clearAll();
    await SecureStorage.instance.clearAll();
    
    _isInitialized = false;
    
    debugPrint('🔄 Network Framework reset');
  }

  /// Check if framework is initialized
  static bool get isInitialized => _isInitialized;

  /// Wait for initialization to complete
  static Future<void> waitForInitialization() async {
    if (_isInitialized) return;
    return _initCompleter.future;
  }
}
