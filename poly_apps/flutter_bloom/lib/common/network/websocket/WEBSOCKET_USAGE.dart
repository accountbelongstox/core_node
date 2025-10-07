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

/// WebSocket Usage Examples
/// 
/// This file demonstrates how to use the universal WebSocket library

import 'websocket_client.dart';
import 'websocket_config.dart';
import 'websocket_types.dart';
import 'websocket_interceptor.dart';

/// Example 1: Basic WebSocket Connection
void exampleBasicConnection() async {
  // Create config with URL (no hardcoded URLs!)
  final config = WebSocketConfig(
    url: 'wss://your-websocket-server.com/ws',
    enableLogging: true,
  );

  // Create client
  final client = BaseWebSocketClient(config: config);

  // Listen to messages
  client.messages.listen((message) {
    print('Received: $message');
  });

  // Connect
  await client.connect();

  // Send message
  client.send({'type': 'hello', 'data': 'world'});

  // Disconnect when done
  await client.disconnect();
}

/// Example 2: WebSocket with Authentication
void exampleWithAuthentication() async {
  // Create config with auth token
  final config = WebSocketConfig.withAuth(
    url: 'wss://your-websocket-server.com/ws',
    token: 'your-auth-token-here',
    enableLogging: true,
  );

  final client = BaseWebSocketClient(config: config);

  // Listen to connection state changes
  client.stateChanges.listen((state) {
    print('State changed to: $state');
  });

  await client.connect();
}

/// Example 3: WebSocket with Custom Headers
void exampleWithCustomHeaders() async {
  final config = WebSocketConfig.withHeaders(
    url: 'wss://your-websocket-server.com/ws',
    headers: {
      'X-API-Key': 'your-api-key',
      'X-Client-Version': '1.0.0',
      'X-Device-ID': 'device-123',
    },
    enableLogging: true,
  );

  final client = BaseWebSocketClient(config: config);
  await client.connect();
}

/// Example 4: WebSocket with Interceptors
void exampleWithInterceptors() async {
  final config = WebSocketConfig(
    url: 'wss://your-websocket-server.com/ws',
  );

  // Add interceptors
  final client = BaseWebSocketClient(
    config: config,
    interceptors: [
      LoggingWebSocketInterceptor(enableVerbose: true),
      AuthWebSocketInterceptor(
        token: 'your-token',
        onTokenExpired: () {
          print('Token expired! Please refresh.');
        },
      ),
      TransformWebSocketInterceptor(
        outgoingTransform: (message) {
          // Add custom metadata to all outgoing messages
          if (message is Map<String, dynamic>) {
            message['timestamp'] = DateTime.now().toIso8601String();
          }
          return message;
        },
        incomingTransform: (message) {
          // Process all incoming messages
          print('Processing incoming message...');
          return message;
        },
      ),
    ],
  );

  await client.connect();
}

/// Example 5: WebSocket with Auto-Reconnection
void exampleWithAutoReconnection() async {
  final config = WebSocketConfig(
    url: 'wss://your-websocket-server.com/ws',
    enableReconnection: true,
    reconnectionStrategy: ReconnectionStrategy.exponential,
    maxReconnectionAttempts: 10,
    initialReconnectionDelay: Duration(seconds: 2),
    maxReconnectionDelay: Duration(seconds: 60),
    enableLogging: true,
  );

  final client = BaseWebSocketClient(config: config);

  // Listen to reconnection events
  client.events.listen((event) {
    if (event.type == WebSocketEventType.reconnecting) {
      final data = event.data as Map<String, dynamic>;
      print('Reconnecting: attempt ${data['attempt']}/${data['maxAttempts']}');
    }
  });

  await client.connect();
}

/// Example 6: WebSocket with Heartbeat
void exampleWithHeartbeat() async {
  final config = WebSocketConfig(
    url: 'wss://your-websocket-server.com/ws',
    enableHeartbeat: true,
    pingInterval: Duration(seconds: 30),
    pongTimeout: Duration(seconds: 10),
    enableLogging: true,
  );

  final client = BaseWebSocketClient(config: config);

  // Listen to pong events
  client.events.listen((event) {
    if (event.type == WebSocketEventType.pong) {
      print('Pong received!');
    }
  });

  await client.connect();
}

/// Example 7: App-Specific WebSocket Client (like AChat)
class MyAppWebSocketClient extends BaseWebSocketClient {
  MyAppWebSocketClient({required WebSocketConfig config})
      : super(config: config);

  /// Factory: Create with URL and credentials
  factory MyAppWebSocketClient.create({
    required String url,
    required String token,
    required String userId,
    bool enableLogging = false,
  }) {
    return MyAppWebSocketClient(
      config: WebSocketConfig.withAuth(
        url: url,
        token: token,
        enableLogging: enableLogging,
      ),
    );
  }

  /// Override message stream to handle app-specific logic
  @override
  Stream<dynamic> get messages {
    return super.messages.map((message) {
      // Process app-specific messages here
      if (message is Map<String, dynamic>) {
        _handleAppMessage(message);
      }
      return message;
    });
  }

  void _handleAppMessage(Map<String, dynamic> message) {
    final type = message['type'];
    switch (type) {
      case 'user_message':
        _handleUserMessage(message);
        break;
      case 'system_notification':
        _handleSystemNotification(message);
        break;
      default:
        print('Unknown message type: $type');
    }
  }

  void _handleUserMessage(Map<String, dynamic> message) {
    print('User message: ${message['data']}');
  }

  void _handleSystemNotification(Map<String, dynamic> message) {
    print('System notification: ${message['data']}');
  }

  /// Send app-specific message
  void sendAppMessage(String type, Map<String, dynamic> data) {
    send({
      'type': type,
      'data': data,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }
}

/// Example usage of app-specific client
void exampleAppSpecificClient() async {
  final client = MyAppWebSocketClient.create(
    url: 'wss://myapp.com/ws',
    token: 'user-token',
    userId: 'user-123',
    enableLogging: true,
  );

  // Listen to processed messages
  client.messages.listen((message) {
    print('App message: $message');
  });

  await client.connect();

  // Send app-specific message
  client.sendAppMessage('chat_message', {
    'text': 'Hello, World!',
    'chatId': 'chat-456',
  });
}

