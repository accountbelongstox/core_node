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

/// WebSocket Configuration
/// 
/// Provides flexible configuration for WebSocket connections

/// WebSocket reconnection strategy
enum ReconnectionStrategy {
  none,
  linear,
  exponential,
}

/// WebSocket configuration
class WebSocketConfig {
  final String url;
  final Duration? connectionTimeout;
  final Duration? pingInterval;
  final Duration? pongTimeout;
  final Map<String, dynamic>? headers;
  final Map<String, dynamic>? protocols;
  final bool enableHeartbeat;
  final bool enableReconnection;
  final ReconnectionStrategy reconnectionStrategy;
  final int maxReconnectionAttempts;
  final Duration initialReconnectionDelay;
  final Duration maxReconnectionDelay;
  final bool enableLogging;
  final bool enableCompression;

  const WebSocketConfig({
    required this.url,
    this.connectionTimeout = const Duration(seconds: 30),
    this.pingInterval = const Duration(seconds: 30),
    this.pongTimeout = const Duration(seconds: 10),
    this.headers,
    this.protocols,
    this.enableHeartbeat = true,
    this.enableReconnection = true,
    this.reconnectionStrategy = ReconnectionStrategy.exponential,
    this.maxReconnectionAttempts = 5,
    this.initialReconnectionDelay = const Duration(seconds: 1),
    this.maxReconnectionDelay = const Duration(seconds: 30),
    this.enableLogging = false,
    this.enableCompression = false,
  });

  /// Create WebSocket configuration with authentication
  factory WebSocketConfig.withAuth({
    required String url,
    required String token,
    String tokenPrefix = 'Bearer',
    Duration? connectionTimeout,
    Duration? pingInterval,
    bool enableHeartbeat = true,
    bool enableReconnection = true,
    bool enableLogging = false,
  }) {
    return WebSocketConfig(
      url: url,
      connectionTimeout: connectionTimeout,
      pingInterval: pingInterval,
      headers: {
        'Authorization': '$tokenPrefix $token',
      },
      enableHeartbeat: enableHeartbeat,
      enableReconnection: enableReconnection,
      enableLogging: enableLogging,
    );
  }

  /// Create WebSocket configuration with custom headers
  factory WebSocketConfig.withHeaders({
    required String url,
    required Map<String, dynamic> headers,
    Duration? connectionTimeout,
    Duration? pingInterval,
    bool enableHeartbeat = true,
    bool enableReconnection = true,
    bool enableLogging = false,
  }) {
    return WebSocketConfig(
      url: url,
      connectionTimeout: connectionTimeout,
      pingInterval: pingInterval,
      headers: headers,
      enableHeartbeat: enableHeartbeat,
      enableReconnection: enableReconnection,
      enableLogging: enableLogging,
    );
  }

  /// Create minimal WebSocket configuration
  factory WebSocketConfig.minimal({
    required String url,
    Duration? connectionTimeout,
    bool enableLogging = false,
  }) {
    return WebSocketConfig(
      url: url,
      connectionTimeout: connectionTimeout,
      enableHeartbeat: false,
      enableReconnection: false,
      enableLogging: enableLogging,
    );
  }

  /// Copy configuration with modifications
  WebSocketConfig copyWith({
    String? url,
    Duration? connectionTimeout,
    Duration? pingInterval,
    Duration? pongTimeout,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? protocols,
    bool? enableHeartbeat,
    bool? enableReconnection,
    ReconnectionStrategy? reconnectionStrategy,
    int? maxReconnectionAttempts,
    Duration? initialReconnectionDelay,
    Duration? maxReconnectionDelay,
    bool? enableLogging,
    bool? enableCompression,
  }) {
    return WebSocketConfig(
      url: url ?? this.url,
      connectionTimeout: connectionTimeout ?? this.connectionTimeout,
      pingInterval: pingInterval ?? this.pingInterval,
      pongTimeout: pongTimeout ?? this.pongTimeout,
      headers: headers ?? this.headers,
      protocols: protocols ?? this.protocols,
      enableHeartbeat: enableHeartbeat ?? this.enableHeartbeat,
      enableReconnection: enableReconnection ?? this.enableReconnection,
      reconnectionStrategy: reconnectionStrategy ?? this.reconnectionStrategy,
      maxReconnectionAttempts: maxReconnectionAttempts ?? this.maxReconnectionAttempts,
      initialReconnectionDelay: initialReconnectionDelay ?? this.initialReconnectionDelay,
      maxReconnectionDelay: maxReconnectionDelay ?? this.maxReconnectionDelay,
      enableLogging: enableLogging ?? this.enableLogging,
      enableCompression: enableCompression ?? this.enableCompression,
    );
  }

  @override
  String toString() {
    return 'WebSocketConfig(url: $url, enableHeartbeat: $enableHeartbeat, enableReconnection: $enableReconnection)';
  }
}

