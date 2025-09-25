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

/// WebSocket connection states
enum WebSocketState {
  disconnected,
  connecting,
  connected,
  reconnecting,
  error,
}

/// WebSocket event types
enum WebSocketEventType {
  connected,
  disconnected,
  error,
  message,
  reconnecting,
}

/// WebSocket event wrapper
class WebSocketEvent {
  final WebSocketEventType type;
  final dynamic data;
  final String? error;
  final DateTime timestamp;

  WebSocketEvent({
    required this.type,
    this.data,
    this.error,
  }) : timestamp = DateTime.now();
}

/// Base WebSocket client that apps can extend
abstract class BaseWebSocketClient {
  String? _url;
  WebSocket? _socket;
  WebSocketState _state = WebSocketState.disconnected;
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;

  int _reconnectAttempts = 0;
  int maxReconnectAttempts = 5;
  Duration reconnectInterval = const Duration(seconds: 5);
  Duration heartbeatInterval = const Duration(seconds: 30);
  bool _shouldReconnect = false;

  final StreamController<WebSocketEvent> _eventController =
      StreamController<WebSocketEvent>.broadcast();
  final StreamController<Map<String, dynamic>> _messageController =
      StreamController<Map<String, dynamic>>.broadcast();

  /// Stream of WebSocket events
  Stream<WebSocketEvent> get events => _eventController.stream;

  /// Stream of parsed messages
  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  /// Current connection state
  WebSocketState get state => _state;

  /// Check if connected
  bool get isConnected => _state == WebSocketState.connected;

  /// Get auth headers for WebSocket connection
  Future<Map<String, String>> getAuthHeaders();

  /// Process incoming message
  Map<String, dynamic>? processIncomingMessage(dynamic rawMessage);

  /// Process outgoing message
  String processOutgoingMessage(Map<String, dynamic> message);

  /// Connect to WebSocket server
  Future<void> connect(String url, {Map<String, String>? headers}) async {
    if (_state == WebSocketState.connected || _state == WebSocketState.connecting) {
      return;
    }

    _url = url;
    _setState(WebSocketState.connecting);
    _shouldReconnect = true;

    try {
      final authHeaders = await getAuthHeaders();
      final combinedHeaders = <String, String>{};

      if (headers != null) {
        combinedHeaders.addAll(headers);
      }
      combinedHeaders.addAll(authHeaders);

      if (kDebugMode) {
        print('WebSocket connecting to: $url');
      }

      _socket = await WebSocket.connect(url, headers: combinedHeaders);
      _setState(WebSocketState.connected);
      _reconnectAttempts = 0;

      _emitEvent(WebSocketEvent(type: WebSocketEventType.connected));

      _socket!.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDisconnection,
        cancelOnError: false,
      );

      _startHeartbeat();

      if (kDebugMode) {
        print('WebSocket connected successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('WebSocket connection failed: $e');
      }
      _setState(WebSocketState.error);
      _emitEvent(WebSocketEvent(
        type: WebSocketEventType.error,
        error: 'Connection failed: $e',
      ));
      _scheduleReconnect();
    }
  }

  /// Disconnect from WebSocket server
  Future<void> disconnect() async {
    _shouldReconnect = false;
    _stopHeartbeat();
    _stopReconnect();

    if (_socket != null) {
      try {
        await _socket!.close();
      } catch (e) {
        if (kDebugMode) {
          print('Error closing WebSocket: $e');
        }
      }
      _socket = null;
    }

    _setState(WebSocketState.disconnected);
    _emitEvent(WebSocketEvent(type: WebSocketEventType.disconnected));

    if (kDebugMode) {
      print('WebSocket disconnected');
    }
  }

  /// Send message through WebSocket
  void sendMessage(Map<String, dynamic> message) {
    if (!isConnected) {
      if (kDebugMode) {
        print('Cannot send message: WebSocket not connected');
      }
      return;
    }

    try {
      final processedMessage = processOutgoingMessage(message);
      _socket!.add(processedMessage);

      if (kDebugMode) {
        print('WebSocket message sent: $message');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error sending WebSocket message: $e');
      }
      _emitEvent(WebSocketEvent(
        type: WebSocketEventType.error,
        error: 'Send failed: $e',
      ));
    }
  }

  /// Send ping message
  void sendPing() {
    sendMessage({
      'type': 'ping',
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void _handleMessage(dynamic rawMessage) {
    try {
      final message = processIncomingMessage(rawMessage);
      if (message != null) {
        if (kDebugMode) {
          print('WebSocket message received: $message');
        }

        _emitEvent(WebSocketEvent(
          type: WebSocketEventType.message,
          data: message,
        ));

        _messageController.add(message);

        // Handle pong response
        if (message['type'] == 'pong') {
          if (kDebugMode) {
            print('WebSocket pong received');
          }
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error processing WebSocket message: $e');
      }
      _emitEvent(WebSocketEvent(
        type: WebSocketEventType.error,
        error: 'Message processing failed: $e',
      ));
    }
  }

  void _handleError(dynamic error) {
    if (kDebugMode) {
      print('WebSocket error: $error');
    }
    _setState(WebSocketState.error);
    _emitEvent(WebSocketEvent(
      type: WebSocketEventType.error,
      error: error.toString(),
    ));
    _scheduleReconnect();
  }

  void _handleDisconnection() {
    if (kDebugMode) {
      print('WebSocket disconnected');
    }
    _setState(WebSocketState.disconnected);
    _emitEvent(WebSocketEvent(type: WebSocketEventType.disconnected));
    _stopHeartbeat();

    if (_shouldReconnect) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (!_shouldReconnect || _reconnectAttempts >= maxReconnectAttempts) {
      if (kDebugMode) {
        print('Maximum reconnect attempts reached or reconnect disabled');
      }
      return;
    }

    _reconnectAttempts++;
    _setState(WebSocketState.reconnecting);
    _emitEvent(WebSocketEvent(type: WebSocketEventType.reconnecting));

    final delay = Duration(
      seconds: reconnectInterval.inSeconds * _reconnectAttempts,
    );

    if (kDebugMode) {
      print('Scheduling WebSocket reconnect in ${delay.inSeconds} seconds (attempt $_reconnectAttempts)');
    }

    _reconnectTimer = Timer(delay, () {
      if (_shouldReconnect && _url != null) {
        connect(_url!);
      }
    });
  }

  void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(heartbeatInterval, (timer) {
      if (isConnected) {
        sendPing();
      } else {
        timer.cancel();
      }
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void _stopReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectAttempts = 0;
  }

  void _setState(WebSocketState newState) {
    if (_state != newState) {
      _state = newState;
      if (kDebugMode) {
        print('WebSocket state changed to: $newState');
      }
    }
  }

  void _emitEvent(WebSocketEvent event) {
    if (!_eventController.isClosed) {
      _eventController.add(event);
    }
  }

  /// Dispose resources
  void dispose() {
    disconnect();
    _eventController.close();
    _messageController.close();
    _stopHeartbeat();
    _stopReconnect();
  }
}

/// Default WebSocket client implementation
class DefaultWebSocketClient extends BaseWebSocketClient {
  String? _authToken;

  void setAuthToken(String? token) {
    _authToken = token;
  }

  @override
  Future<Map<String, String>> getAuthHeaders() async {
    final headers = <String, String>{};
    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  @override
  Map<String, dynamic>? processIncomingMessage(dynamic rawMessage) {
    try {
      if (rawMessage is String) {
        return json.decode(rawMessage) as Map<String, dynamic>;
      } else if (rawMessage is Map<String, dynamic>) {
        return rawMessage;
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('Error parsing incoming WebSocket message: $e');
      }
      return null;
    }
  }

  @override
  String processOutgoingMessage(Map<String, dynamic> message) {
    return json.encode(message);
  }
}