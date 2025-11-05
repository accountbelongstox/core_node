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

import 'websocket_types.dart';

/// WebSocket Interceptor Interface
/// 
/// Allows modification of messages and events before/after processing

abstract class WebSocketInterceptor {
  /// Called before a message is sent
  /// Return null to cancel the message
  dynamic onBeforeSend(dynamic message);

  /// Called after a message is received
  /// Return null to cancel the message processing
  dynamic onAfterReceive(dynamic message);

  /// Called when an error occurs
  WebSocketError onError(WebSocketError error);

  /// Called when connection state changes
  void onStateChange(WebSocketState oldState, WebSocketState newState);

  /// Called before connection
  Map<String, dynamic>? onBeforeConnect(String url, Map<String, dynamic>? headers);

  /// Called after connection
  void onAfterConnect();

  /// Called before disconnect
  void onBeforeDisconnect();

  /// Called after disconnect
  void onAfterDisconnect();
}

/// Base WebSocket interceptor with default implementations
class BaseWebSocketInterceptor implements WebSocketInterceptor {
  @override
  dynamic onBeforeSend(dynamic message) => message;

  @override
  dynamic onAfterReceive(dynamic message) => message;

  @override
  WebSocketError onError(WebSocketError error) => error;

  @override
  void onStateChange(WebSocketState oldState, WebSocketState newState) {}

  @override
  Map<String, dynamic>? onBeforeConnect(String url, Map<String, dynamic>? headers) => headers;

  @override
  void onAfterConnect() {}

  @override
  void onBeforeDisconnect() {}

  @override
  void onAfterDisconnect() {}
}

/// Logging interceptor for debugging
class LoggingWebSocketInterceptor extends BaseWebSocketInterceptor {
  final bool enableVerbose;

  LoggingWebSocketInterceptor({this.enableVerbose = false});

  @override
  dynamic onBeforeSend(dynamic message) {
    print('[WebSocket] >>> Sending: $message');
    return message;
  }

  @override
  dynamic onAfterReceive(dynamic message) {
    if (enableVerbose) {
      print('[WebSocket] <<< Received: $message');
    } else {
      print('[WebSocket] <<< Received message');
    }
    return message;
  }

  @override
  WebSocketError onError(WebSocketError error) {
    print('[WebSocket] !!! Error: ${error.message}');
    return error;
  }

  @override
  void onStateChange(WebSocketState oldState, WebSocketState newState) {
    print('[WebSocket] State: $oldState -> $newState');
  }

  @override
  Map<String, dynamic>? onBeforeConnect(String url, Map<String, dynamic>? headers) {
    print('[WebSocket] Connecting to: $url');
    if (enableVerbose && headers != null) {
      print('[WebSocket] Headers: $headers');
    }
    return headers;
  }

  @override
  void onAfterConnect() {
    print('[WebSocket] Connected successfully');
  }

  @override
  void onBeforeDisconnect() {
    print('[WebSocket] Disconnecting...');
  }

  @override
  void onAfterDisconnect() {
    print('[WebSocket] Disconnected');
  }
}

/// Authentication interceptor for token injection
class AuthWebSocketInterceptor extends BaseWebSocketInterceptor {
  String? _token;
  final String _tokenPrefix;
  final Function()? _onTokenExpired;

  AuthWebSocketInterceptor({
    String? token,
    String tokenPrefix = 'Bearer',
    Function()? onTokenExpired,
  })  : _token = token,
        _tokenPrefix = tokenPrefix,
        _onTokenExpired = onTokenExpired;

  void setToken(String token) {
    _token = token;
  }

  void clearToken() {
    _token = null;
  }

  String? get token => _token;

  @override
  Map<String, dynamic>? onBeforeConnect(String url, Map<String, dynamic>? headers) {
    if (_token != null) {
      final newHeaders = headers ?? {};
      newHeaders['Authorization'] = '$_tokenPrefix $_token';
      return newHeaders;
    }
    return headers;
  }

  @override
  dynamic onBeforeSend(dynamic message) {
    // Inject token into message metadata if needed
    if (_token != null && message is Map<String, dynamic>) {
      message['_auth_token'] = _token;
    }
    return message;
  }

  @override
  WebSocketError onError(WebSocketError error) {
    // Check if error is due to expired token
    if (error.message.contains('401') || error.message.contains('Unauthorized')) {
      _onTokenExpired?.call();
    }
    return error;
  }
}

/// Message transformation interceptor
class TransformWebSocketInterceptor extends BaseWebSocketInterceptor {
  final dynamic Function(dynamic)? outgoingTransform;
  final dynamic Function(dynamic)? incomingTransform;

  TransformWebSocketInterceptor({
    this.outgoingTransform,
    this.incomingTransform,
  });

  @override
  dynamic onBeforeSend(dynamic message) {
    if (outgoingTransform != null) {
      return outgoingTransform!(message);
    }
    return message;
  }

  @override
  dynamic onAfterReceive(dynamic message) {
    if (incomingTransform != null) {
      return incomingTransform!(message);
    }
    return message;
  }
}

