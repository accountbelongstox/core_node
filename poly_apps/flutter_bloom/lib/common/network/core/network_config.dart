import 'package:flutter/foundation.dart';
// Fix: Import all shared types from network_types.dart as single source of truth
import 'network_types.dart' show RequestPriority, AuthType, RequestType, CacheStrategy;

/// Abstract base network configuration
/// Each app should extend this with their specific configuration
abstract class BaseNetworkConfig {
  // Base configuration - to be overridden by apps
  String get baseUrl;
  Duration get connectTimeout => const Duration(seconds: 30);
  Duration get receiveTimeout => const Duration(seconds: 30);
  Duration get sendTimeout => const Duration(seconds: 30);

  // Retry configuration
  int get maxRetries => 3;
  Duration get retryDelay => const Duration(seconds: 1);
  List<int> get retryStatusCodes => [408, 429, 500, 502, 503, 504];

  // Cache configuration
  bool get enableCache => true;
  Duration get defaultCacheDuration => const Duration(minutes: 5);
  int get maxCacheSize => 100; // MB

  // Queue configuration
  bool get enableQueue => true;
  int get maxConcurrentRequests => 5;
  int get maxQueueSize => 100;

  // Global headers - can be overridden
  Map<String, String> get globalHeaders => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'FlutterApp/1.0.0',
  };

  // Authentication configuration - to be overridden
  AuthConfig get authConfig;

  // Logging configuration
  bool get enableLogging => kDebugMode;
  LogLevel get logLevel => kDebugMode ? LogLevel.verbose : LogLevel.error;

  // Loading state configuration
  bool get enableGlobalLoading => true;
  Duration get loadingDebounce => const Duration(milliseconds: 300);

  // Error handling configuration
  bool get enableGlobalErrorHandling => true;
  bool get showErrorSnackbar => true;
}

/// Default network configuration for framework internal use
class DefaultNetworkConfig extends BaseNetworkConfig {
  @override
  String get baseUrl => 'https://api.example.com';

  @override
  AuthConfig get authConfig => AuthConfig();
}

/// Network configuration manager
class NetworkConfig {
  static BaseNetworkConfig? _instance;
  static BaseNetworkConfig get instance => _instance ?? DefaultNetworkConfig();

  /// Set the network configuration for the current app
  static void setConfig(BaseNetworkConfig config) {
    _instance = config;
  }

  /// Create default configuration
  static BaseNetworkConfig defaultConfig() => DefaultNetworkConfig();
}

/// Authentication configuration
class AuthConfig {
  AuthType authType = AuthType.jwt;
  String tokenKey = 'Authorization';
  String tokenPrefix = 'Bearer ';
  String refreshTokenKey = 'refresh_token';
  String clientIdKey = 'X-Client-ID';
  String clientSecretKey = 'X-Client-Secret';
  String sessionKey = 'X-Session-ID';
  String deviceIdKey = 'X-Device-ID';
  String appSignatureKey = 'X-App-Signature';
  String timestampKey = 'X-Timestamp';
  String nonceKey = 'X-Nonce';
  
  // Custom auth fields
  Map<String, String> customAuthFields = {};
  
  // Auto refresh token
  bool autoRefreshToken = true;
  Duration tokenRefreshThreshold = const Duration(minutes: 5);
  
  // Token storage
  bool persistToken = true;
  String tokenStorageKey = 'auth_token';
  String refreshTokenStorageKey = 'refresh_token';
}

/// Log levels
enum LogLevel {
  none,
  error,
  warning,
  info,
  debug,
  verbose,
}

/// Endpoint group configuration
class EndpointGroup {
  final String name;
  final String? basePath;
  final RequestType requestType;
  final AuthType? authType;
  final Map<String, String>? headers;
  final Duration? timeout;
  final bool? enableCache;
  final Duration? cacheDuration;
  final CacheStrategy? cacheStrategy;
  final int? maxRetries;
  final RequestPriority priority;
  final Map<String, dynamic>? metadata;

  const EndpointGroup({
    required this.name,
    this.basePath,
    this.requestType = RequestType.public,
    this.authType,
    this.headers,
    this.timeout,
    this.enableCache,
    this.cacheDuration,
    this.cacheStrategy,
    this.maxRetries,
    this.priority = RequestPriority.normal,
    this.metadata,
  });

  EndpointGroup copyWith({
    String? name,
    String? basePath,
    RequestType? requestType,
    AuthType? authType,
    Map<String, String>? headers,
    Duration? timeout,
    bool? enableCache,
    Duration? cacheDuration,
    CacheStrategy? cacheStrategy,
    int? maxRetries,
    RequestPriority? priority,
    Map<String, dynamic>? metadata,
  }) {
    return EndpointGroup(
      name: name ?? this.name,
      basePath: basePath ?? this.basePath,
      requestType: requestType ?? this.requestType,
      authType: authType ?? this.authType,
      headers: headers ?? this.headers,
      timeout: timeout ?? this.timeout,
      enableCache: enableCache ?? this.enableCache,
      cacheDuration: cacheDuration ?? this.cacheDuration,
      cacheStrategy: cacheStrategy ?? this.cacheStrategy,
      maxRetries: maxRetries ?? this.maxRetries,
      priority: priority ?? this.priority,
      metadata: metadata ?? this.metadata,
    );
  }
}

/// Predefined endpoint groups
class EndpointGroups {
  static const EndpointGroup public = EndpointGroup(
    name: 'public',
    requestType: RequestType.public,
    enableCache: true,
    cacheDuration: Duration(minutes: 5),
    priority: RequestPriority.normal,
  );

  static const EndpointGroup auth = EndpointGroup(
    name: 'auth',
    basePath: '/auth',
    requestType: RequestType.public,
    enableCache: false,
    priority: RequestPriority.high,
  );

  static const EndpointGroup authenticated = EndpointGroup(
    name: 'authenticated',
    requestType: RequestType.authenticated,
    authType: AuthType.jwt,
    enableCache: true,
    cacheDuration: Duration(minutes: 3),
    priority: RequestPriority.normal,
  );

  static const EndpointGroup authorized = EndpointGroup(
    name: 'authorized',
    requestType: RequestType.authorized,
    authType: AuthType.jwt,
    enableCache: false,
    priority: RequestPriority.high,
  );

  static const EndpointGroup admin = EndpointGroup(
    name: 'admin',
    basePath: '/admin',
    requestType: RequestType.admin,
    authType: AuthType.jwt,
    enableCache: false,
    priority: RequestPriority.critical,
  );
}
