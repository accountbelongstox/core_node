import 'package:flutter/foundation.dart';

/// Network configuration for the entire application
class NetworkConfig {
  static NetworkConfig? _instance;
  static NetworkConfig get instance => _instance ??= NetworkConfig._();
  NetworkConfig._();

  // Base configuration
  String baseUrl = 'https://api.si.12gm.com';
  Duration connectTimeout = const Duration(seconds: 30);
  Duration receiveTimeout = const Duration(seconds: 30);
  Duration sendTimeout = const Duration(seconds: 30);
  
  // Retry configuration
  int maxRetries = 3;
  Duration retryDelay = const Duration(seconds: 1);
  List<int> retryStatusCodes = [408, 429, 500, 502, 503, 504];
  
  // Cache configuration
  bool enableCache = true;
  Duration defaultCacheDuration = const Duration(minutes: 5);
  int maxCacheSize = 100; // MB
  
  // Queue configuration
  bool enableQueue = true;
  int maxConcurrentRequests = 5;
  int maxQueueSize = 100;
  
  // Global headers
  Map<String, String> globalHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'FlutterApp/1.0.0',
  };
  
  // Authentication configuration
  AuthConfig authConfig = AuthConfig();
  
  // Logging configuration
  bool enableLogging = kDebugMode;
  LogLevel logLevel = kDebugMode ? LogLevel.verbose : LogLevel.error;
  
  // Loading state configuration
  bool enableGlobalLoading = true;
  Duration loadingDebounce = const Duration(milliseconds: 300);
  
  // Error handling configuration
  bool enableGlobalErrorHandling = true;
  bool showErrorSnackbar = true;
  
  /// Update configuration
  void updateConfig({
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
  }) {
    if (baseUrl != null) this.baseUrl = baseUrl;
    if (connectTimeout != null) this.connectTimeout = connectTimeout;
    if (receiveTimeout != null) this.receiveTimeout = receiveTimeout;
    if (sendTimeout != null) this.sendTimeout = sendTimeout;
    if (maxRetries != null) this.maxRetries = maxRetries;
    if (retryDelay != null) this.retryDelay = retryDelay;
    if (retryStatusCodes != null) this.retryStatusCodes = retryStatusCodes;
    if (enableCache != null) this.enableCache = enableCache;
    if (defaultCacheDuration != null) this.defaultCacheDuration = defaultCacheDuration;
    if (maxCacheSize != null) this.maxCacheSize = maxCacheSize;
    if (enableQueue != null) this.enableQueue = enableQueue;
    if (maxConcurrentRequests != null) this.maxConcurrentRequests = maxConcurrentRequests;
    if (maxQueueSize != null) this.maxQueueSize = maxQueueSize;
    if (globalHeaders != null) this.globalHeaders.addAll(globalHeaders);
    if (authConfig != null) this.authConfig = authConfig;
    if (enableLogging != null) this.enableLogging = enableLogging;
    if (logLevel != null) this.logLevel = logLevel;
    if (enableGlobalLoading != null) this.enableGlobalLoading = enableGlobalLoading;
    if (loadingDebounce != null) this.loadingDebounce = loadingDebounce;
    if (enableGlobalErrorHandling != null) this.enableGlobalErrorHandling = enableGlobalErrorHandling;
    if (showErrorSnackbar != null) this.showErrorSnackbar = showErrorSnackbar;
  }
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

/// Authentication types
enum AuthType {
  none,
  jwt,
  session,
  clientKey,
  custom,
  multiple, // Support multiple auth types simultaneously
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

/// Request priority levels
enum RequestPriority {
  low,
  normal,
  high,
  critical,
}

/// Cache strategies
enum CacheStrategy {
  none,
  memory,
  disk,
  both,
}

/// Request types for different authentication requirements
enum RequestType {
  public,        // No authentication required
  authenticated, // Basic authentication required (login)
  authorized,    // Specific permission required
  admin,         // Admin permission required
  custom,        // Custom authentication logic
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
