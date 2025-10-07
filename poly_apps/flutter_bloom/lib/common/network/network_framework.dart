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

// FIXED: Resolved export conflicts by hiding duplicate type definitions
// Core exports - network_types.dart is the primary source for shared types
export 'core/network_types.dart'; // Primary source for all shared types
// Fix: network_config.dart now imports all shared types from network_types.dart
export 'core/network_config.dart' hide LogLevel, NetworkConfig, AuthConfig;
// REFACTOR: Renamed network_models.dart to endpoint_network_models.dart
// FIXED: Hide CancelToken to avoid conflict with network_types.dart
export 'core/endpoint_network_models.dart' hide NetworkErrorType, NetworkResponse, NetworkRequest, CancelToken;
// REFACTOR: UnifiedNetworkClient is now production-ready (was SimpleNetworkClient stub)
export 'core/unified_network_client.dart';

// WebSocket exports - NEW: Universal WebSocket library
export 'websocket/websocket_client.dart';
export 'websocket/websocket_config.dart';
export 'websocket/websocket_types.dart';
export 'websocket/websocket_interceptor.dart';
export 'core/network_service_locator.dart' hide ServiceNotRegisteredException, NetworkConfig;
// Fix: network_retry_manager.dart now imports RequestPriority from network_types.dart
export 'core/network_retry_manager.dart' hide NetworkRetryException, ConnectivityMonitor;
export 'core/network_queue_and_offline.dart' hide QueueStats, OfflineStats;

// Authentication exports
export 'auth/unified_auth_manager.dart' hide AuthResult;

// Controller exports - Reusable authentication controller template
export 'controller/auth_controller.dart';

// Models exports - avoid duplicate type exports
// FIXED: Hide NetworkResponse from api_response.dart to avoid conflict with network_types.dart
export 'models/api_response.dart' hide NetworkErrorType, NetworkResponse;
export 'models/api_config.dart';

// Endpoints exports - avoid duplicate type exports
export 'endpoints/endpoint_config.dart';
export 'endpoints/laravel_endpoints.dart' hide LaravelEndpoints;

// Services exports
// FIXED: Hide CancelToken from advanced_network_service.dart to avoid conflict with network_models.dart
export 'services/advanced_network_service.dart' hide CancelToken, NetworkError, NetworkErrorType;
// REMOVED: base_service.dart and enhanced_base_service.dart (redundant, use AdvancedNetworkService)

// Storage exports
export 'storage/secure_storage.dart';

// Interceptors exports - avoid duplicate type exports
export 'interceptors/network_interceptors.dart';
export 'interceptors/auth_interceptor.dart';
export 'interceptors/error_interceptor.dart' hide NetworkError;
export 'interceptors/logging_interceptor.dart' hide LogLevel;

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

// FIXED: Removed duplicate exports that were already exported above

import 'dart:async';
import 'package:flutter/foundation.dart';
// FIXED: Added 'as types' prefix to resolve NetworkConfig type conflict
import 'core/network_types.dart' as types;
import 'core/network_config.dart';
import 'auth/unified_auth_manager.dart';
import '../cache_manager/cache_manager.dart';
// FIXED: Removed unused imports
// import 'core/network_queue_and_offline.dart';
// import 'ui/global_loading_system.dart';
// import 'core/unified_network_client.dart';
// import 'interceptors/network_interceptors.dart';
import 'storage/secure_storage.dart';

/// Main network framework class
class NetworkFramework {
  static bool _isInitialized = false;
  static final Completer<void> _initCompleter = Completer<void>();
  static BaseNetworkConfig? _currentConfig;

  /// Initialize the network framework
  static Future<void> initialize({
    BaseNetworkConfig? config,
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

      // Store the provided config
      if (config != null) {
        _currentConfig = config;
      } else {
        // Create a default config if none provided
        throw ArgumentError('NetworkFramework.initialize() requires a config parameter');
      }

      // Initialize core components
      await SecureStorage.instance.initialize();
      // FIXED: UnifiedAuthManager.initialize expects types.NetworkConfig not BaseNetworkConfig
      // Also need to convert AuthType enum from network_config to network_types
      await UnifiedAuthManager.instance.initialize(
        config: types.NetworkConfig(
          baseUrl: _currentConfig!.baseUrl,
          authConfig: types.AuthConfig(
            // FIXED: Convert AuthType enum by name matching (network_config.AuthType -> network_types.AuthType)
            authType: types.AuthType.values.firstWhere(
              (e) => e.name == _currentConfig!.authConfig.authType.name,
              orElse: () => types.AuthType.none,
            ),
          ),
        ),
      );
      await CacheManager.instance.initialize();
      // Note: RequestQueue and NetworkClient simplified - no initialization needed

      _isInitialized = true;
      _initCompleter.complete();

      debugPrint('✅ Network Framework initialized successfully');
      debugPrint('   Base URL: ${_currentConfig!.baseUrl}');
      debugPrint('   Auth Type: ${_currentConfig!.authConfig.authType}');
      debugPrint('   Cache Enabled: ${_currentConfig!.enableCache}');
      debugPrint('   Queue Enabled: ${_currentConfig!.enableQueue}');
      debugPrint('   Global Loading: ${_currentConfig!.enableGlobalLoading}');

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
    // Configuration is now immutable after initialization
    debugPrint('⚠️ NetworkFramework.configure() is deprecated. Use app-specific config classes instead.');
  }

  /// Get framework status
  static Map<String, dynamic> getStatus() {
    return {
      'isInitialized': _isInitialized,
      'config': _currentConfig != null ? {
        'baseUrl': _currentConfig!.baseUrl,
        'authType': _currentConfig!.authConfig.authType.toString(),
        'enableCache': _currentConfig!.enableCache,
        'enableQueue': _currentConfig!.enableQueue,
        'enableGlobalLoading': _currentConfig!.enableGlobalLoading,
        'enableLogging': _currentConfig!.enableLogging,
        'logLevel': _currentConfig!.logLevel.toString(),
      } : null,
      'auth': UnifiedAuthManager.instance.getAuthSummary(),
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
      'storage': await SecureStorage.instance.getStorageStats(),
      // Note: RequestQueue and LoadingManager simplified - no stats available
    };
  }

  /// Reset framework (for testing)
  static Future<void> reset() async {
    await UnifiedAuthManager.instance.clearAuth();
    await CacheManager.instance.clear('all');
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
