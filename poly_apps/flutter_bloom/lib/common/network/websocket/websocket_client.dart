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
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'websocket_config.dart';
import 'websocket_types.dart';
import 'websocket_interceptor.dart';

/// Base WebSocket Client
/// 
/// Provides a robust, configurable WebSocket client with:
/// - Automatic reconnection
/// - Heartbeat/ping-pong mechanism
/// - Interceptor support
/// - State management
/// - Type-safe messaging
class BaseWebSocketClient {
  final WebSocketConfig config;
  final List<WebSocketInterceptor> interceptors;

  WebSocket? _socket;
  WebSocketState _state = WebSocketState.disconnected;
  Timer? _heartbeatTimer;
  Timer? _pongTimer;
  Timer? _reconnectionTimer;
  int _reconnectionAttempts = 0;
  DateTime? _lastPingTime;
  bool _isDisposed = false;
  bool _isManualDisconnect = false;

  final StreamController<WebSocketEvent> _eventController =
      StreamController<WebSocketEvent>.broadcast();
  final StreamController<dynamic> _messageController =
      StreamController<dynamic>.broadcast();
  final StreamController<WebSocketState> _stateController =
      StreamController<WebSocketState>.broadcast();

  /// Stream of WebSocket events
  Stream<WebSocketEvent> get events => _eventController.stream;

  /// Stream of incoming messages
  Stream<dynamic> get messages => _messageController.stream;

  /// Stream of connection state changes
  Stream<WebSocketState> get stateChanges => _stateController.stream;

  /// Current connection state
  WebSocketState get state => _state;

  /// Check if connected
  bool get isConnected => _state == WebSocketState.connected;

  /// Check if connecting
  bool get isConnecting => _state == WebSocketState.connecting || _state == WebSocketState.reconnecting;

  BaseWebSocketClient({
    required this.config,
    List<WebSocketInterceptor>? interceptors,
  }) : interceptors = interceptors ?? [];

  /// Connect to WebSocket server
  Future<void> connect() async {
    if (_isDisposed) {
      throw StateError('WebSocket client is disposed');
    }

    if (isConnected || isConnecting) {
      if (config.enableLogging) {
        debugPrint('[WebSocket] Already connected or connecting');
      }
      return;
    }

    _isManualDisconnect = false;
    _updateState(WebSocketState.connecting);

    try {
      // Call interceptors before connect
      Map<String, dynamic>? headers = config.headers;
      for (final interceptor in interceptors) {
        headers = interceptor.onBeforeConnect(config.url, headers);
      }

      // Create connection with timeout
      final connectionFuture = WebSocket.connect(
        config.url,
        headers: headers,
        compression: config.enableCompression ? CompressionOptions.compressionDefault : CompressionOptions.compressionOff,
      );

      _socket = await (config.connectionTimeout != null
          ? connectionFuture.timeout(config.connectionTimeout!)
          : connectionFuture);

      _updateState(WebSocketState.connected);
      _reconnectionAttempts = 0;

      // Call interceptors after connect
      for (final interceptor in interceptors) {
        interceptor.onAfterConnect();
      }

      // Emit connected event
      _emitEvent(WebSocketEvent(type: WebSocketEventType.connected));

      // Setup message listener
      _socket!.listen(
        _handleIncomingMessage,
        onError: _handleError,
        onDone: _handleDone,
        cancelOnError: false,
      );

      // Start heartbeat if enabled
      if (config.enableHeartbeat) {
        _startHeartbeat();
      }

      if (config.enableLogging) {
        debugPrint('[WebSocket] Connected to ${config.url}');
      }
    } catch (e, stackTrace) {
      final error = WebSocketError(
        message: 'Connection failed: $e',
        originalError: e,
        stackTrace: stackTrace,
        isFatal: false,
      );
      _handleWebSocketError(error);

      // Attempt reconnection if enabled
      if (config.enableReconnection && !_isManualDisconnect) {
        _scheduleReconnection();
      } else {
        _updateState(WebSocketState.disconnected);
      }
    }
  }

  /// Disconnect from WebSocket server
  Future<void> disconnect({int code = 1000, String reason = 'Normal closure'}) async {
    if (_isDisposed) {
      return;
    }

    _isManualDisconnect = true;
    _updateState(WebSocketState.disconnecting);

    // Call interceptors before disconnect
    for (final interceptor in interceptors) {
      interceptor.onBeforeDisconnect();
    }

    _stopHeartbeat();
    _cancelReconnection();

    try {
      await _socket?.close(code, reason);
      _socket = null;
    } catch (e) {
      if (config.enableLogging) {
        debugPrint('[WebSocket] Error during disconnect: $e');
      }
    }

    _updateState(WebSocketState.disconnected);

    // Call interceptors after disconnect
    for (final interceptor in interceptors) {
      interceptor.onAfterDisconnect();
    }

    _emitEvent(WebSocketEvent(type: WebSocketEventType.disconnected));

    if (config.enableLogging) {
      debugPrint('[WebSocket] Disconnected');
    }
  }

  /// Send message through WebSocket
  void send(dynamic message) {
    if (!isConnected) {
      throw StateError('WebSocket is not connected');
    }

    if (_isDisposed) {
      throw StateError('WebSocket client is disposed');
    }

    try {
      // Apply interceptors
      dynamic processedMessage = message;
      for (final interceptor in interceptors) {
        processedMessage = interceptor.onBeforeSend(processedMessage);
        if (processedMessage == null) {
          if (config.enableLogging) {
            debugPrint('[WebSocket] Message cancelled by interceptor');
          }
          return;
        }
      }

      // Convert message to string if needed
      String messageString;
      if (processedMessage is String) {
        messageString = processedMessage;
      } else if (processedMessage is Map || processedMessage is List) {
        messageString = json.encode(processedMessage);
      } else {
        messageString = processedMessage.toString();
      }

      _socket!.add(messageString);

      if (config.enableLogging) {
        debugPrint('[WebSocket] Sent: $messageString');
      }
    } catch (e) {
      final error = WebSocketError(
        message: 'Failed to send message: $e',
        originalError: e,
      );
      _handleWebSocketError(error);
    }
  }

  /// Send JSON message
  void sendJson(Map<String, dynamic> data) {
    send(json.encode(data));
  }

  /// Send ping
  void ping([String? message]) {
    if (!isConnected) {
      return;
    }

    try {
      _lastPingTime = DateTime.now();
      final pingMessage = message ?? 'ping';
      send({'type': 'ping', 'message': pingMessage});

      if (config.enableLogging) {
        debugPrint('[WebSocket] Ping sent');
      }
    } catch (e) {
      if (config.enableLogging) {
        debugPrint('[WebSocket] Failed to send ping: $e');
      }
    }
  }

  void _handleIncomingMessage(dynamic rawMessage) {
    if (_isDisposed) {
      return;
    }

    try {
      // Apply interceptors
      dynamic processedMessage = rawMessage;
      for (final interceptor in interceptors) {
        processedMessage = interceptor.onAfterReceive(processedMessage);
        if (processedMessage == null) {
          return;
        }
      }

      // Parse message
      dynamic message = processedMessage;
      if (message is String) {
        try {
          message = json.decode(message);
        } catch (_) {
          // Not JSON, keep as string
        }
      }

      // Check for pong response
      if (message is Map && message['type'] == 'pong') {
        _handlePong();
        return;
      }

      // Emit message
      _messageController.add(message);
      _emitEvent(WebSocketEvent(
        type: WebSocketEventType.message,
        data: message,
      ));

      if (config.enableLogging) {
        debugPrint('[WebSocket] Received message');
      }
    } catch (e) {
      if (config.enableLogging) {
        debugPrint('[WebSocket] Error processing message: $e');
      }
    }
  }

  void _handleError(dynamic error) {
    if (_isDisposed) {
      return;
    }

    final wsError = WebSocketError(
      message: 'WebSocket error: $error',
      originalError: error,
    );
    _handleWebSocketError(wsError);
  }

  void _handleDone() {
    if (_isDisposed) {
      return;
    }

    if (config.enableLogging) {
      debugPrint('[WebSocket] Connection closed');
    }

    _stopHeartbeat();

    if (_state != WebSocketState.disconnecting && !_isManualDisconnect) {
      _updateState(WebSocketState.disconnected);
      _emitEvent(WebSocketEvent(type: WebSocketEventType.disconnected));

      // Attempt reconnection if enabled
      if (config.enableReconnection) {
        _scheduleReconnection();
      }
    }
  }

  void _handlePong() {
    _pongTimer?.cancel();
    _emitEvent(WebSocketEvent(type: WebSocketEventType.pong));

    if (config.enableLogging && _lastPingTime != null) {
      final latency = DateTime.now().difference(_lastPingTime!);
      debugPrint('[WebSocket] Pong received (latency: ${latency.inMilliseconds}ms)');
    }
  }

  void _handleWebSocketError(WebSocketError error) {
    // Apply error interceptors
    WebSocketError processedError = error;
    for (final interceptor in interceptors) {
      processedError = interceptor.onError(processedError);
    }

    _emitEvent(WebSocketEvent(
      type: WebSocketEventType.error,
      error: processedError.message,
      data: processedError,
    ));

    if (config.enableLogging) {
      debugPrint('[WebSocket] Error: ${processedError.message}');
    }

    if (processedError.isFatal) {
      disconnect(code: 1011, reason: 'Fatal error');
    }
  }

  void _startHeartbeat() {
    _stopHeartbeat();

    if (config.pingInterval == null) {
      return;
    }

    _heartbeatTimer = Timer.periodic(config.pingInterval!, (timer) {
      if (isConnected) {
        ping();

        // Start pong timeout
        if (config.pongTimeout != null) {
          _pongTimer = Timer(config.pongTimeout!, () {
            if (config.enableLogging) {
              debugPrint('[WebSocket] Pong timeout, reconnecting...');
            }
            _socket?.close(1002, 'Pong timeout');
          });
        }
      }
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _pongTimer?.cancel();
    _pongTimer = null;
  }

  void _scheduleReconnection() {
    if (_reconnectionAttempts >= config.maxReconnectionAttempts) {
      if (config.enableLogging) {
        debugPrint('[WebSocket] Max reconnection attempts reached');
      }
      _updateState(WebSocketState.disconnected);
      return;
    }

    _reconnectionAttempts++;
    _updateState(WebSocketState.reconnecting);
    _emitEvent(WebSocketEvent(
      type: WebSocketEventType.reconnecting,
      data: {'attempt': _reconnectionAttempts, 'maxAttempts': config.maxReconnectionAttempts},
    ));

    Duration delay;
    switch (config.reconnectionStrategy) {
      case ReconnectionStrategy.linear:
        delay = config.initialReconnectionDelay * _reconnectionAttempts;
        break;
      case ReconnectionStrategy.exponential:
        delay = config.initialReconnectionDelay * (1 << (_reconnectionAttempts - 1));
        break;
      case ReconnectionStrategy.none:
        _updateState(WebSocketState.disconnected);
        return;
    }

    // Cap at max delay
    if (delay > config.maxReconnectionDelay) {
      delay = config.maxReconnectionDelay;
    }

    if (config.enableLogging) {
      debugPrint('[WebSocket] Reconnecting in ${delay.inSeconds}s (attempt $_reconnectionAttempts/${config.maxReconnectionAttempts})');
    }

    _reconnectionTimer = Timer(delay, () {
      if (!_isDisposed && !_isManualDisconnect) {
        connect();
      }
    });
  }

  void _cancelReconnection() {
    _reconnectionTimer?.cancel();
    _reconnectionTimer = null;
    _reconnectionAttempts = 0;
  }

  void _updateState(WebSocketState newState) {
    final oldState = _state;
    _state = newState;
    _stateController.add(newState);

    // Notify interceptors
    for (final interceptor in interceptors) {
      interceptor.onStateChange(oldState, newState);
    }
  }

  void _emitEvent(WebSocketEvent event) {
    if (!_eventController.isClosed) {
      _eventController.add(event);
    }
  }

  /// Dispose the client
  void dispose() {
    if (_isDisposed) {
      return;
    }

    _isDisposed = true;
    _isManualDisconnect = true;

    _stopHeartbeat();
    _cancelReconnection();

    _socket?.close(1000, 'Client disposed');
    _socket = null;

    _eventController.close();
    _messageController.close();
    _stateController.close();

    if (config.enableLogging) {
      debugPrint('[WebSocket] Client disposed');
    }
  }
}

