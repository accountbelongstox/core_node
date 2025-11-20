import 'dart:async';
// FIXED: Removed unused 'dart:io' import

/// Core network types for the unified network framework
/// Defines common interfaces, enums, and data structures

// ================================
// ENUMS
// ================================

/// Authentication types supported by the framework
enum AuthType {
  none,
  jwt,
  clientId,
  clientKey,
  headerKey,
  session,
  custom,
  multiple,
}

/// Request types with different authentication requirements
enum RequestType {
  public,
  authenticated,
  authorized,
  admin,
  custom,
}

/// Request priority levels for queue management
enum RequestPriority {
  low,
  normal,
  high,
  critical,
}

/// Cache strategies
enum CacheStrategy {
  noCache,
  cacheFirst,
  networkFirst,
  cacheOnly,
  networkOnly,
  staleWhileRevalidate,
}

/// Network connectivity states
enum ConnectivityState {
  none,
  wifi,
  mobile,
  ethernet,
  vpn,
  unknown,
}

/// Request methods
enum RequestMethod {
  get,
  post,
  put,
  patch,
  delete,
  head,
  options,
}

// ================================
// DATA CLASSES
// ================================

/// Network request configuration
class NetworkRequest {
  final String endpoint;
  final RequestMethod method;
  final Map<String, dynamic>? parameters;
  final Map<String, String>? headers;
  final dynamic body;
  final RequestType requestType;
  final RequestPriority priority;
  final Duration? timeout;
  final int? maxRetries;
  final bool enableCache;
  final Duration? cacheStaleTime;
  final bool allowOffline;
  final String? permission;
  final Map<String, dynamic>? metadata;

  const NetworkRequest({
    required this.endpoint,
    this.method = RequestMethod.get,
    this.parameters,
    this.headers,
    this.body,
    this.requestType = RequestType.public,
    this.priority = RequestPriority.normal,
    this.timeout,
    this.maxRetries,
    this.enableCache = false,
    this.cacheStaleTime,
    this.allowOffline = false,
    this.permission,
    this.metadata,
  });

  /// Get HTTP method string
  String get methodString {
    switch (method) {
      case RequestMethod.get: return 'GET';
      case RequestMethod.post: return 'POST';
      case RequestMethod.put: return 'PUT';
      case RequestMethod.patch: return 'PATCH';
      case RequestMethod.delete: return 'DELETE';
      case RequestMethod.head: return 'HEAD';
      case RequestMethod.options: return 'OPTIONS';
    }
  }

  /// Generate cache key for this request
  String get cacheKey {
    final buffer = StringBuffer();
    buffer.write(methodString);
    buffer.write('|');
    buffer.write(endpoint);

    if (parameters != null && parameters!.isNotEmpty) {
      final sortedKeys = parameters!.keys.toList()..sort();
      buffer.write('|');
      for (final key in sortedKeys) {
        buffer.write('$key=${parameters![key]}&');
      }
    }

    return buffer.toString();
  }

  NetworkRequest copyWith({
    String? endpoint,
    RequestMethod? method,
    Map<String, dynamic>? parameters,
    Map<String, String>? headers,
    dynamic body,
    RequestType? requestType,
    RequestPriority? priority,
    Duration? timeout,
    int? maxRetries,
    bool? enableCache,
    Duration? cacheStaleTime,
    bool? allowOffline,
    String? permission,
    Map<String, dynamic>? metadata,
  }) {
    return NetworkRequest(
      endpoint: endpoint ?? this.endpoint,
      method: method ?? this.method,
      parameters: parameters ?? this.parameters,
      headers: headers ?? this.headers,
      body: body ?? this.body,
      requestType: requestType ?? this.requestType,
      priority: priority ?? this.priority,
      timeout: timeout ?? this.timeout,
      maxRetries: maxRetries ?? this.maxRetries,
      enableCache: enableCache ?? this.enableCache,
      cacheStaleTime: cacheStaleTime ?? this.cacheStaleTime,
      allowOffline: allowOffline ?? this.allowOffline,
      permission: permission ?? this.permission,
      metadata: metadata ?? this.metadata,
    );
  }
}

/// Network response wrapper
class NetworkResponse<T> {
  final T? data;
  final int? statusCode;
  final String? message;
  final String? error;
  final Map<String, String>? headers;
  final bool isFromCache;
  final bool isStale;
  final bool isOffline;
  final DateTime timestamp;
  final Duration? latency;
  final int? retryCount;
  final Map<String, dynamic>? metadata;

  // FIXED: Removed 'const' keyword because constructor uses DateTime.now() which is not a compile-time constant
  NetworkResponse({
    this.data,
    this.statusCode,
    this.message,
    this.error,
    this.headers,
    this.isFromCache = false,
    this.isStale = false,
    this.isOffline = false,
    DateTime? timestamp,
    this.latency,
    this.retryCount,
    this.metadata,
  }) : timestamp = timestamp ?? DateTime.now();

  /// Check if response is successful
  bool get isSuccess => statusCode != null && statusCode! >= 200 && statusCode! < 300;

  /// Check if response has error
  bool get hasError => error != null || (statusCode != null && statusCode! >= 400);

  NetworkResponse<T> copyWith({
    T? data,
    int? statusCode,
    String? message,
    String? error,
    Map<String, String>? headers,
    bool? isFromCache,
    bool? isStale,
    bool? isOffline,
    DateTime? timestamp,
    Duration? latency,
    int? retryCount,
    Map<String, dynamic>? metadata,
  }) {
    return NetworkResponse<T>(
      data: data ?? this.data,
      statusCode: statusCode ?? this.statusCode,
      message: message ?? this.message,
      error: error ?? this.error,
      headers: headers ?? this.headers,
      isFromCache: isFromCache ?? this.isFromCache,
      isStale: isStale ?? this.isStale,
      isOffline: isOffline ?? this.isOffline,
      timestamp: timestamp ?? this.timestamp,
      latency: latency ?? this.latency,
      retryCount: retryCount ?? this.retryCount,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  String toString() {
    return 'NetworkResponse(statusCode: $statusCode, isSuccess: $isSuccess, '
           'isFromCache: $isFromCache, isStale: $isStale, isOffline: $isOffline)';
  }
}

/// Authentication metadata for user provider integration
class AuthMetadata {
  final AuthType authType;
  final String? jwtToken;
  final String? refreshToken;
  final String? clientId;
  final String? sessionId;
  final String? headerKey;
  final String? headerValue;
  final Map<String, String>? customHeaders;
  final DateTime? expiresAt;
  final DateTime? authenticatedAt;
  final bool isAuthenticated;

  const AuthMetadata({
    this.authType = AuthType.none,
    this.jwtToken,
    this.refreshToken,
    this.clientId,
    this.sessionId,
    this.headerKey,
    this.headerValue,
    this.customHeaders,
    this.expiresAt,
    this.authenticatedAt,
    this.isAuthenticated = false,
  });

  AuthMetadata copyWith({
    AuthType? authType,
    String? jwtToken,
    String? refreshToken,
    String? clientId,
    String? sessionId,
    String? headerKey,
    String? headerValue,
    Map<String, String>? customHeaders,
    DateTime? expiresAt,
    DateTime? authenticatedAt,
    bool? isAuthenticated,
  }) {
    return AuthMetadata(
      authType: authType ?? this.authType,
      jwtToken: jwtToken ?? this.jwtToken,
      refreshToken: refreshToken ?? this.refreshToken,
      clientId: clientId ?? this.clientId,
      sessionId: sessionId ?? this.sessionId,
      headerKey: headerKey ?? this.headerKey,
      headerValue: headerValue ?? this.headerValue,
      customHeaders: customHeaders ?? this.customHeaders,
      expiresAt: expiresAt ?? this.expiresAt,
      authenticatedAt: authenticatedAt ?? this.authenticatedAt,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}

/// Network configuration
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
  final bool enableCompression;
  final int compressionThreshold;
  final AuthConfig authConfig;
  final ResponseValidation responseValidation;

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
    this.enableCompression = true,
    this.compressionThreshold = 1024,
    this.authConfig = const AuthConfig(),
    this.responseValidation = const ResponseValidation(),
  });

  factory NetworkConfig.production({required String baseUrl}) {
    return NetworkConfig(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: 15),
      receiveTimeout: Duration(seconds: 60),
      maxRetries: 2,
      maxCacheSize: 200,
      maxConcurrentRequests: 5,
      compressionThreshold: 512,
    );
  }

  factory NetworkConfig.development({required String baseUrl}) {
    return NetworkConfig(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 120),
      maxRetries: 5,
      maxCacheSize: 50,
      maxConcurrentRequests: 2,
      enableCompression: false,
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
    bool? enableCompression,
    int? compressionThreshold,
    AuthConfig? authConfig,
    ResponseValidation? responseValidation,
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
      enableCompression: enableCompression ?? this.enableCompression,
      compressionThreshold: compressionThreshold ?? this.compressionThreshold,
      authConfig: authConfig ?? this.authConfig,
      responseValidation: responseValidation ?? this.responseValidation,
    );
  }
}

/// Authentication configuration
class AuthConfig {
  final AuthType authType;
  final String tokenKey;
  final String tokenPrefix;
  final String clientIdKey;
  final String clientSecretKey;
  final String sessionKey;
  final String deviceIdKey;
  final String appSignatureKey;
  final String timestampKey;
  final String nonceKey;
  final bool persistToken;
  final String tokenStorageKey;
  final String refreshTokenStorageKey;
  final Duration tokenRefreshThreshold;

  const AuthConfig({
    this.authType = AuthType.jwt,
    this.tokenKey = 'Authorization',
    this.tokenPrefix = 'Bearer ',
    this.clientIdKey = 'X-Client-ID',
    this.clientSecretKey = 'X-Client-Secret',
    this.sessionKey = 'X-Session-ID',
    this.deviceIdKey = 'X-Device-ID',
    this.appSignatureKey = 'X-App-Signature',
    this.timestampKey = 'X-Timestamp',
    this.nonceKey = 'X-Nonce',
    this.persistToken = true,
    this.tokenStorageKey = 'auth_token',
    this.refreshTokenStorageKey = 'refresh_token',
    this.tokenRefreshThreshold = const Duration(minutes: 5),
  });

  AuthConfig copyWith({
    AuthType? authType,
    String? tokenKey,
    String? tokenPrefix,
    String? clientIdKey,
    String? clientSecretKey,
    String? sessionKey,
    String? deviceIdKey,
    String? appSignatureKey,
    String? timestampKey,
    String? nonceKey,
    bool? persistToken,
    String? tokenStorageKey,
    String? refreshTokenStorageKey,
    Duration? tokenRefreshThreshold,
  }) {
    return AuthConfig(
      authType: authType ?? this.authType,
      tokenKey: tokenKey ?? this.tokenKey,
      tokenPrefix: tokenPrefix ?? this.tokenPrefix,
      clientIdKey: clientIdKey ?? this.clientIdKey,
      clientSecretKey: clientSecretKey ?? this.clientSecretKey,
      sessionKey: sessionKey ?? this.sessionKey,
      deviceIdKey: deviceIdKey ?? this.deviceIdKey,
      appSignatureKey: appSignatureKey ?? this.appSignatureKey,
      timestampKey: timestampKey ?? this.timestampKey,
      nonceKey: nonceKey ?? this.nonceKey,
      persistToken: persistToken ?? this.persistToken,
      tokenStorageKey: tokenStorageKey ?? this.tokenStorageKey,
      refreshTokenStorageKey: refreshTokenStorageKey ?? this.refreshTokenStorageKey,
      tokenRefreshThreshold: tokenRefreshThreshold ?? this.tokenRefreshThreshold,
    );
  }
}

/// Response validation configuration
class ResponseValidation {
  final bool Function(int statusCode, Map<String, dynamic>? body) isSuccess;
  final String? Function(Map<String, dynamic>? body) getErrorMessage;

  const ResponseValidation({
    this.isSuccess = _defaultIsSuccess,
    this.getErrorMessage = _defaultGetErrorMessage,
  });

  static bool _defaultIsSuccess(int statusCode, Map<String, dynamic>? body) {
    return statusCode >= 200 && statusCode < 300;
  }

  static String? _defaultGetErrorMessage(Map<String, dynamic>? body) {
    if (body == null) return null;
    return body['error']?.toString() ??
           body['message']?.toString() ??
           body['msg']?.toString();
  }
}

// ================================
// INTERFACES
// ================================

/// Base network client interface
abstract class NetworkClient {
  Future<NetworkResponse<T>> request<T>(NetworkRequest request);
  Future<void> dispose();
}

/// Cache manager interface
abstract class CacheManager {
  Future<NetworkResponse<T>?> get<T>(String key);
  Future<void> store<T>(String key, NetworkResponse<T> response, {Duration? duration});
  Future<void> invalidate(String key);
  Future<void> clear();
  CacheStats getStats();
}

/// Request queue interface
abstract class RequestQueue {
  Future<NetworkResponse<T>> enqueue<T>(
    Future<NetworkResponse<T>> Function() request,
    {RequestPriority priority}
  );
  QueueStats getStats();
  Future<void> dispose();
}

/// Offline manager interface
abstract class OfflineManager {
  Future<void> queueRequest(NetworkRequest request);
  Future<void> syncPendingRequests();
  OfflineStats getStats();
  Future<void> dispose();
}

/// Connectivity monitor interface
abstract class ConnectivityMonitor {
  Stream<ConnectivityState> get onConnectivityChanged;
  ConnectivityState get currentState;
  Future<void> initialize();
  Future<void> dispose();
}

// ================================
// UTILITY CLASSES
// ================================

/// Cancel token for request cancellation
/// Allows cancelling in-flight network requests
class CancelToken {
  bool _isCancelled = false;
  String? _cancelReason;
  final List<VoidCallback> _listeners = [];

  /// Whether this token has been cancelled
  bool get isCancelled => _isCancelled;
  
  /// The reason for cancellation if provided
  String? get cancelReason => _cancelReason;

  /// Cancel the associated request
  void cancel([String? reason]) {
    if (_isCancelled) return;
    _isCancelled = true;
    _cancelReason = reason;
    
    // Notify all listeners
    for (final listener in _listeners) {
      listener();
    }
    _listeners.clear();
  }

  /// Add a cancellation listener
  void addListener(VoidCallback listener) {
    if (_isCancelled) {
      listener();
    } else {
      _listeners.add(listener);
    }
  }

  /// Remove a cancellation listener
  void removeListener(VoidCallback listener) {
    _listeners.remove(listener);
  }

  /// Throw if cancelled
  void throwIfCancelled() {
    if (_isCancelled) {
      throw CancellationException(_cancelReason ?? 'Request cancelled');
    }
  }
}

/// Exception thrown when a request is cancelled
class CancellationException implements Exception {
  final String message;
  const CancellationException(this.message);

  @override
  String toString() => 'CancellationException: $message';
}

/// Callback type for void functions
typedef VoidCallback = void Function();

// ================================
// STATISTICS CLASSES
// ================================

/// Cache statistics
class CacheStats {
  final int memoryEntries;
  final int maxMemoryEntries;
  final int hitCount;
  final int missCount;
  final int evictionCount;
  final double hitRate;
  final int totalSize;

  const CacheStats({
    required this.memoryEntries,
    required this.maxMemoryEntries,
    required this.hitCount,
    required this.missCount,
    required this.evictionCount,
    required this.hitRate,
    required this.totalSize,
  });

  @override
  String toString() {
    return 'CacheStats(entries: $memoryEntries/$maxMemoryEntries, '
           'hits: $hitCount, misses: $missCount, hit rate: ${hitRate.toStringAsFixed(1)}%)';
  }
}

/// Queue statistics
class QueueStats {
  final int criticalCount;
  final int highCount;
  final int normalCount;
  final int lowCount;
  final int activeRequests;
  final bool isProcessing;

  const QueueStats({
    required this.criticalCount,
    required this.highCount,
    required this.normalCount,
    required this.lowCount,
    required this.activeRequests,
    required this.isProcessing,
  });

  int get totalQueued => criticalCount + highCount + normalCount + lowCount;

  @override
  String toString() {
    return 'QueueStats(total: $totalQueued, active: $activeRequests, '
           'critical: $criticalCount, high: $highCount, normal: $normalCount, low: $lowCount)';
  }
}

/// Offline statistics
class OfflineStats {
  final int totalCount;
  final Map<RequestPriority, int> countByPriority;
  final Duration? oldestRequestAge;

  const OfflineStats({
    required this.totalCount,
    required this.countByPriority,
    this.oldestRequestAge,
  });

  @override
  String toString() {
    final ageInfo = oldestRequestAge != null
        ? ', oldest: ${oldestRequestAge!.inMinutes}min'
        : '';
    return 'OfflineStats(total: $totalCount$ageInfo)';
  }
}

// ================================
// EXCEPTIONS
// ================================

/// Base network exception
class NetworkException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic originalError;

  const NetworkException(this.message, {this.statusCode, this.originalError});

  @override
  String toString() => 'NetworkException: $message';
}

/// Authentication exception
class AuthenticationException extends NetworkException {
  const AuthenticationException(super.message, {super.statusCode});

  @override
  String toString() => 'AuthenticationException: $message';
}

/// Authorization exception
class AuthorizationException extends NetworkException {
  const AuthorizationException(super.message, {super.statusCode});

  @override
  String toString() => 'AuthorizationException: $message';
}

/// Network timeout exception
class NetworkTimeoutException extends NetworkException {
  const NetworkTimeoutException(super.message);

  @override
  String toString() => 'NetworkTimeoutException: $message';
}

/// Network retry exception
class NetworkRetryException extends NetworkException {
  final int attemptCount;
  final List<String> attemptErrors;

  const NetworkRetryException(
    super.message,
    this.attemptCount,
    this.attemptErrors,
    {super.statusCode}
  );

  @override
  String toString() => 'NetworkRetryException: $message (attempts: $attemptCount)';
}

/// Offline exception
class OfflineException extends NetworkException {
  const OfflineException(super.message);

  @override
  String toString() => 'OfflineException: $message';
}

/// Service not registered exception
class ServiceNotRegisteredException extends NetworkException {
  const ServiceNotRegisteredException(super.message);

  @override
  String toString() => 'ServiceNotRegisteredException: $message';
}