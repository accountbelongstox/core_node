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
import 'package:flutter/foundation.dart';
import '../../../common/network/websocket_client.dart';
import '../../../common/cache_manager/cache_manager.dart';
import '../models/message_models.dart';
import '../models/chat_models.dart';
import '../models/user_models.dart';
import '../storage/achat_storage_manager.dart';

/// AChat-specific WebSocket events
enum AChatWebSocketEventType {
  messageReceived,
  messageStatusUpdated,
  userTyping,
  userPresenceChanged,
  conversationUpdated,
  groupMemberAdded,
  groupUpdated,
  fileUploadProgress,
  fileUploadCompleted,
  cacheInvalidated,
  notification,
}

/// AChat WebSocket event wrapper
class AChatWebSocketEvent {
  final AChatWebSocketEventType type;
  final dynamic data;
  final String? chatId;
  final String? userId;
  final DateTime timestamp;

  AChatWebSocketEvent({
    required this.type,
    this.data,
    this.chatId,
    this.userId,
  }) : timestamp = DateTime.now();
}

/// AChat WebSocket client with real-time features
class AChatWebSocketClient extends BaseWebSocketClient {
  static const String baseUrl = 'wss://ws.achat.enterprise.com/v1/ws';

  String? _authToken;
  String? _deviceId;
  final StreamController<AChatWebSocketEvent> _achatEventController =
      StreamController<AChatWebSocketEvent>.broadcast();
  final CacheManager _cacheManager = CacheManager.instance;
  final AChatStorageManager _storageManager = AChatStorageManager.instance;

  final Map<String, Timer> _typingTimers = {};
  final Map<String, AChatUserPresence> _userPresences = {};
  final Map<String, List<String>> _typingUsers = {};

  /// Stream of AChat-specific events
  Stream<AChatWebSocketEvent> get achatEvents => _achatEventController.stream;

  /// Get user presences
  Map<String, AChatUserPresence> get userPresences => Map.unmodifiable(_userPresences);

  /// Get typing users for a chat
  List<String> getTypingUsers(String chatId) {
    return List.unmodifiable(_typingUsers[chatId] ?? []);
  }

  /// Set authentication credentials
  void setCredentials({
    required String authToken,
    required String deviceId,
  }) {
    _authToken = authToken;
    _deviceId = deviceId;
  }

  @override
  Future<Map<String, String>> getAuthHeaders() async {
    final headers = <String, String>{};
    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    return headers;
  }

  /// Connect with AChat-specific parameters
  Future<void> connectToAChat() async {
    if (_authToken == null || _deviceId == null) {
      throw Exception('Authentication credentials not set');
    }

    final url = '$baseUrl?token=$_authToken&client_id=$_deviceId';
    await connect(url);
  }

  @override
  Map<String, dynamic>? processIncomingMessage(dynamic rawMessage) {
    try {
      if (rawMessage is String) {
        final message = json.decode(rawMessage) as Map<String, dynamic>;
        _handleAChatMessage(message);
        return message;
      } else if (rawMessage is Map<String, dynamic>) {
        _handleAChatMessage(rawMessage);
        return rawMessage;
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('Error processing AChat WebSocket message: $e');
      }
      return null;
    }
  }

  @override
  String processOutgoingMessage(Map<String, dynamic> message) {
    // Add timestamp and device info to outgoing messages
    message['timestamp'] = DateTime.now().toIso8601String();
    message['client_id'] = _deviceId;
    return json.encode(message);
  }

  void _handleAChatMessage(Map<String, dynamic> message) {
    final type = message['type'] as String?;
    if (type == null) return;

    switch (type) {
      case 'message_received':
        _handleMessageReceived(message);
        break;
      case 'message_status_updated':
        _handleMessageStatusUpdated(message);
        break;
      case 'user_typing':
        _handleUserTyping(message);
        break;
      case 'user_presence_changed':
        _handleUserPresenceChanged(message);
        break;
      case 'conversation_updated':
        _handleConversationUpdated(message);
        break;
      case 'group_member_added':
        _handleGroupMemberAdded(message);
        break;
      case 'group_updated':
        _handleGroupUpdated(message);
        break;
      case 'file_upload_progress':
        _handleFileUploadProgress(message);
        break;
      case 'file_upload_completed':
        _handleFileUploadCompleted(message);
        break;
      case 'cache_invalidated':
        _handleCacheInvalidated(message);
        break;
      case 'notification':
        _handleNotification(message);
        break;
      default:
        if (kDebugMode) {
          print('Unknown AChat WebSocket message type: $type');
        }
    }
  }

  void _handleMessageReceived(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final chatId = data['chat_id'] as String;
      final messageData = data['message'] as Map<String, dynamic>;
      final achatMessage = AChatMessage.fromJson(messageData);

      // Stop typing indicator for sender
      final senderId = achatMessage.sender.id;
      if (data['sender_typing_stopped'] == true) {
        _removeTypingUser(chatId, senderId);
      }

      // Store message locally
      _storageManager.storeMessage(achatMessage);

      // Invalidate message cache
      _cacheManager.clear('messages');
      _cacheManager.clear('conversations');

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.messageReceived,
        data: achatMessage,
        chatId: chatId,
        userId: senderId,
      ));

      if (kDebugMode) {
        print('New message received in chat $chatId from $senderId');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling message received: $e');
      }
    }
  }

  void _handleMessageStatusUpdated(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final messageId = data['message_id'] as String;
      final chatId = data['chat_id'] as String;
      final status = data['status'] as String;
      final updatedBy = data['updated_by'] as String;

      // Update local message status
      _storageManager.updateMessageStatus(messageId, status);

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.messageStatusUpdated,
        data: {
          'messageId': messageId,
          'status': status,
          'updatedBy': updatedBy,
        },
        chatId: chatId,
        userId: updatedBy,
      ));

      if (kDebugMode) {
        print('Message $messageId status updated to $status by $updatedBy');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling message status update: $e');
      }
    }
  }

  void _handleUserTyping(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final chatId = data['chat_id'] as String;
      final user = data['user'] as Map<String, dynamic>;
      final userId = user['id'] as String;
      final isTyping = data['is_typing'] as bool;
      final expiresAt = DateTime.parse(data['expires_at'] as String);

      if (isTyping) {
        _addTypingUser(chatId, userId, expiresAt);
      } else {
        _removeTypingUser(chatId, userId);
      }

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.userTyping,
        data: {
          'isTyping': isTyping,
          'user': user,
          'expiresAt': expiresAt,
        },
        chatId: chatId,
        userId: userId,
      ));
    } catch (e) {
      if (kDebugMode) {
        print('Error handling user typing: $e');
      }
    }
  }

  void _handleUserPresenceChanged(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final userId = data['user_id'] as String;
      final presenceData = data['presence'] as Map<String, dynamic>;
      final isOnline = data['is_online'] as bool;

      final presence = AChatUserPresence.fromJson(presenceData);
      presence.isOnline = isOnline;

      _userPresences[userId] = presence;

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.userPresenceChanged,
        data: presence,
        userId: userId,
      ));

      if (kDebugMode) {
        print('User $userId presence changed: ${presence.status}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling user presence change: $e');
      }
    }
  }

  void _handleConversationUpdated(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final conversation = AChatConversation.fromJson(data);

      // Update local conversation
      _storageManager.storeConversation(conversation);

      // Invalidate conversation cache
      _cacheManager.clear('conversations');

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.conversationUpdated,
        data: conversation,
        chatId: conversation.id,
      ));

      if (kDebugMode) {
        print('Conversation ${conversation.id} updated');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling conversation update: $e');
      }
    }
  }

  void _handleGroupMemberAdded(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final groupId = data['group_id'] as String;
      final member = data['member'] as Map<String, dynamic>;

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.groupMemberAdded,
        data: {
          'groupId': groupId,
          'member': member,
        },
        chatId: groupId,
      ));

      // Invalidate group/conversation cache
      _cacheManager.clear('conversations');

      if (kDebugMode) {
        print('Member added to group $groupId: ${member['name']}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling group member added: $e');
      }
    }
  }

  void _handleGroupUpdated(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final groupId = data['group_id'] as String;
      final changes = data['changes'] as Map<String, dynamic>;
      final updatedBy = data['updated_by'] as String;

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.groupUpdated,
        data: {
          'groupId': groupId,
          'changes': changes,
          'updatedBy': updatedBy,
        },
        chatId: groupId,
        userId: updatedBy,
      ));

      // Invalidate group/conversation cache
      _cacheManager.clear('conversations');

      if (kDebugMode) {
        print('Group $groupId updated by $updatedBy');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling group update: $e');
      }
    }
  }

  void _handleFileUploadProgress(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.fileUploadProgress,
        data: data,
      ));
    } catch (e) {
      if (kDebugMode) {
        print('Error handling file upload progress: $e');
      }
    }
  }

  void _handleFileUploadCompleted(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final fileInfo = AChatFileInfo.fromJson(data['file']);

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.fileUploadCompleted,
        data: fileInfo,
      ));

      if (kDebugMode) {
        print('File upload completed: ${fileInfo.filename}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling file upload completion: $e');
      }
    }
  }

  void _handleCacheInvalidated(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;
      final cacheKeys = List<String>.from(data['cache_keys'] as List);

      for (final key in cacheKeys) {
        if (key.contains('*')) {
          // Pattern-based cache invalidation
          final pattern = key.replaceAll('*', '');
          // For now, clear the entire cache type
          if (pattern.startsWith('chats')) {
            _cacheManager.clear('conversations');
          } else if (pattern.startsWith('messages')) {
            _cacheManager.clear('messages');
          } else if (pattern.startsWith('user_profile')) {
            _cacheManager.clear('user_profile');
          }
        } else {
          // Specific cache key invalidation would require cache manager enhancement
        }
      }

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.cacheInvalidated,
        data: cacheKeys,
      ));

      if (kDebugMode) {
        print('Cache invalidated: $cacheKeys');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling cache invalidation: $e');
      }
    }
  }

  void _handleNotification(Map<String, dynamic> message) {
    try {
      final data = message['data'] as Map<String, dynamic>;

      _emitAChatEvent(AChatWebSocketEvent(
        type: AChatWebSocketEventType.notification,
        data: data,
      ));

      if (kDebugMode) {
        print('Notification received: ${data['title']}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error handling notification: $e');
      }
    }
  }

  void _addTypingUser(String chatId, String userId, DateTime expiresAt) {
    _typingUsers[chatId] ??= [];
    if (!_typingUsers[chatId]!.contains(userId)) {
      _typingUsers[chatId]!.add(userId);
    }

    // Set timer to remove typing user when it expires
    final timerKey = '${chatId}_$userId';
    _typingTimers[timerKey]?.cancel();
    _typingTimers[timerKey] = Timer(
      expiresAt.difference(DateTime.now()),
      () => _removeTypingUser(chatId, userId),
    );
  }

  void _removeTypingUser(String chatId, String userId) {
    _typingUsers[chatId]?.remove(userId);
    if (_typingUsers[chatId]?.isEmpty == true) {
      _typingUsers.remove(chatId);
    }

    final timerKey = '${chatId}_$userId';
    _typingTimers[timerKey]?.cancel();
    _typingTimers.remove(timerKey);
  }

  void _emitAChatEvent(AChatWebSocketEvent event) {
    if (!_achatEventController.isClosed) {
      _achatEventController.add(event);
    }
  }

  /// Send typing indicator
  void sendTyping(String chatId, bool isTyping, {int timeoutMs = 5000}) {
    sendMessage({
      'type': 'typing_update',
      'data': {
        'chat_id': chatId,
        'is_typing': isTyping,
        'timeout': timeoutMs,
      },
    });
  }

  /// Update user presence
  void updatePresence(String status, {String? message}) {
    sendMessage({
      'type': 'presence_update',
      'data': {
        'status': status,
        'message': message,
      },
    });
  }

  /// Join chat room for real-time updates
  void joinChatRoom(String chatId) {
    sendMessage({
      'type': 'join_room',
      'data': {
        'room': 'chat_$chatId',
      },
    });
  }

  /// Leave chat room
  void leaveChatRoom(String chatId) {
    sendMessage({
      'type': 'leave_room',
      'data': {
        'room': 'chat_$chatId',
      },
    });
  }

  @override
  void dispose() {
    for (final timer in _typingTimers.values) {
      timer.cancel();
    }
    _typingTimers.clear();
    _typingUsers.clear();
    _userPresences.clear();
    _achatEventController.close();
    super.dispose();
  }
}