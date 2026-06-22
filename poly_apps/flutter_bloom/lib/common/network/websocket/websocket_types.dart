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

/// WebSocket Type Definitions
/// 
/// Core types for WebSocket communication system
library;


/// WebSocket connection state
enum WebSocketState {
  disconnected,
  connecting,
  connected,
  reconnecting,
  disconnecting,
  error,
}

/// WebSocket close code
enum WebSocketCloseCode {
  normalClosure(1000),
  goingAway(1001),
  protocolError(1002),
  unsupportedData(1003),
  noStatusReceived(1005),
  abnormalClosure(1006),
  invalidFramePayloadData(1007),
  policyViolation(1008),
  messageTooBig(1009),
  mandatoryExtension(1010),
  internalServerError(1011),
  tlsHandshake(1015);

  final int code;
  const WebSocketCloseCode(this.code);
}

/// WebSocket event type
enum WebSocketEventType {
  connected,
  disconnected,
  message,
  error,
  reconnecting,
  pong,
}

/// WebSocket event wrapper
class WebSocketEvent {
  final WebSocketEventType type;
  final dynamic data;
  final DateTime timestamp;
  final String? error;

  WebSocketEvent({
    required this.type,
    this.data,
    this.error,
  }) : timestamp = DateTime.now();

  @override
  String toString() {
    return 'WebSocketEvent(type: $type, data: $data, error: $error, timestamp: $timestamp)';
  }
}

/// WebSocket message wrapper
class WebSocketMessage {
  final dynamic data;
  final DateTime timestamp;
  final Map<String, dynamic>? metadata;

  WebSocketMessage({
    required this.data,
    this.metadata,
  }) : timestamp = DateTime.now();

  Map<String, dynamic> toJson() {
    return {
      'data': data,
      'timestamp': timestamp.toIso8601String(),
      'metadata': metadata,
    };
  }

  factory WebSocketMessage.fromJson(Map<String, dynamic> json) {
    return WebSocketMessage(
      data: json['data'],
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  @override
  String toString() {
    return 'WebSocketMessage(data: $data, timestamp: $timestamp, metadata: $metadata)';
  }
}

/// WebSocket error wrapper
class WebSocketError {
  final String message;
  final dynamic originalError;
  final StackTrace? stackTrace;
  final DateTime timestamp;
  final bool isFatal;

  WebSocketError({
    required this.message,
    this.originalError,
    this.stackTrace,
    this.isFatal = false,
  }) : timestamp = DateTime.now();

  @override
  String toString() {
    return 'WebSocketError(message: $message, isFatal: $isFatal, timestamp: $timestamp)';
  }
}

