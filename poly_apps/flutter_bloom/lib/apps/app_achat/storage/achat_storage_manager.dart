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
import '../../../common/storage/storage_manager.dart';
import '../models/message_models.dart';
import '../models/chat_models.dart';
import '../models/user_models.dart';

/// AChat-specific storage manager extending common StorageManager
class AChatStorageManager {
  static AChatStorageManager? _instance;
  static AChatStorageManager get instance => _instance ??= AChatStorageManager._internal();

  AChatStorageManager._internal();

  final StorageManager _storage = StorageManager.instance;

  // Box names for different data types
  static const String _conversationsBox = 'achat_conversations';
  static const String _messagesBox = 'achat_messages';
  static const String _usersBox = 'achat_users';
  static const String _draftsBox = 'achat_drafts';
  static const String _settingsBox = 'achat_settings';
  static const String _offlineQueueBox = 'achat_offline_queue';

  /// Initialize AChat storage
  Future<void> initialize() async {
    await _storage.init(appName: 'AChat', subDirectory: 'achat_data');

    // Open all required boxes
    await Future.wait([
      _storage.openBox(_conversationsBox),
      _storage.openBox(_messagesBox),
      _storage.openBox(_usersBox),
      _storage.openBox(_draftsBox),
      _storage.openBox(_settingsBox),
      _storage.openBox(_offlineQueueBox),
    ]);

    if (kDebugMode) {
      print('AChat storage initialized');
    }
  }

  /// Conversation Storage
  Future<void> storeConversation(AChatConversation conversation) async {
    await _storage.putValue(
      _conversationsBox,
      conversation.id,
      conversation.toJson(),
    );
  }

  Future<void> storeConversations(List<AChatConversation> conversations) async {
    for (final conversation in conversations) {
      await storeConversation(conversation);
    }
  }

  Future<AChatConversation?> getConversation(String conversationId) async {
    final data = await _storage.getValue<Map<String, dynamic>>(
      _conversationsBox,
      conversationId,
    );

    if (data != null) {
      try {
        return AChatConversation.fromJson(data);
      } catch (e) {
        if (kDebugMode) {
          print('Error parsing conversation $conversationId: $e');
        }
        return null;
      }
    }
    return null;
  }

  Future<List<AChatConversation>> getAllConversations() async {
    final allData = await _storage.getAllFromBox(_conversationsBox);
    final conversations = <AChatConversation>[];

    for (final entry in allData.entries) {
      try {
        final conversation = AChatConversation.fromJson(entry.value as Map<String, dynamic>);
        conversations.add(conversation);
      } catch (e) {
        if (kDebugMode) {
          print('Error parsing conversation ${entry.key}: $e');
        }
      }
    }

    // Sort by updated_at descending
    conversations.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return conversations;
  }

  Future<void> deleteConversation(String conversationId) async {
    await _storage.deleteKey(_conversationsBox, conversationId);
    // Also delete all messages for this conversation
    await deleteMessagesForConversation(conversationId);
  }

  Future<void> updateConversationUnreadCount(String conversationId, int unreadCount) async {
    final conversation = await getConversation(conversationId);
    if (conversation != null) {
      final updated = conversation.copyWith(unreadCount: unreadCount);
      await storeConversation(updated);
    }
  }

  Future<void> updateConversationLastMessage(String conversationId, AChatMessage message) async {
    final conversation = await getConversation(conversationId);
    if (conversation != null) {
      final updated = conversation.copyWith(
        lastMessage: message,
        updatedAt: DateTime.now(),
      );
      await storeConversation(updated);
    }
  }

  /// Message Storage
  Future<void> storeMessage(AChatMessage message) async {
    final key = '${message.chatId}_${message.id}';
    await _storage.putValue(
      _messagesBox,
      key,
      message.toJson(),
    );
  }

  Future<void> storeMessages(List<AChatMessage> messages) async {
    for (final message in messages) {
      await storeMessage(message);
    }
  }

  Future<AChatMessage?> getMessage(String chatId, String messageId) async {
    final key = '${chatId}_$messageId';
    final data = await _storage.getValue<Map<String, dynamic>>(
      _messagesBox,
      key,
    );

    if (data != null) {
      try {
        return AChatMessage.fromJson(data);
      } catch (e) {
        if (kDebugMode) {
          print('Error parsing message $messageId: $e');
        }
        return null;
      }
    }
    return null;
  }

  Future<List<AChatMessage>> getMessagesForConversation(
    String chatId, {
    int? limit,
    DateTime? before,
    DateTime? after,
  }) async {
    final allData = await _storage.getAllFromBox(_messagesBox);
    final messages = <AChatMessage>[];

    for (final entry in allData.entries) {
      final key = entry.key as String;
      if (key.startsWith('${chatId}_')) {
        try {
          final message = AChatMessage.fromJson(entry.value as Map<String, dynamic>);

          // Apply filters
          if (before != null && message.timestamp.isAfter(before)) continue;
          if (after != null && message.timestamp.isBefore(after)) continue;

          messages.add(message);
        } catch (e) {
          if (kDebugMode) {
            print('Error parsing message from key $key: $e');
          }
        }
      }
    }

    // Sort by timestamp descending (newest first)
    messages.sort((a, b) => b.timestamp.compareTo(a.timestamp));

    // Apply limit
    if (limit != null && messages.length > limit) {
      return messages.take(limit).toList();
    }

    return messages;
  }

  Future<void> deleteMessage(String chatId, String messageId) async {
    final key = '${chatId}_$messageId';
    await _storage.deleteKey(_messagesBox, key);
  }

  Future<void> deleteMessagesForConversation(String chatId) async {
    final allKeys = await _storage.getKeys(_messagesBox);
    final keysToDelete = allKeys.where((key) => key.toString().startsWith('${chatId}_'));

    for (final key in keysToDelete) {
      await _storage.deleteKey(_messagesBox, key.toString());
    }
  }

  Future<void> updateMessageStatus(String messageId, String status) async {
    final allData = await _storage.getAllFromBox(_messagesBox);

    for (final entry in allData.entries) {
      try {
        final message = AChatMessage.fromJson(entry.value as Map<String, dynamic>);
        if (message.id == messageId) {
          final updated = message.copyWith(deliveryStatus: status);
          await storeMessage(updated);
          break;
        }
      } catch (e) {
        if (kDebugMode) {
          print('Error updating message status: $e');
        }
      }
    }
  }

  /// User Storage
  Future<void> storeUser(AChatUser user) async {
    await _storage.putValue(
      _usersBox,
      user.id,
      user.toJson(),
    );
  }

  Future<void> storeCurrentUser(AChatUser user) async {
    await _storage.putValue(
      _usersBox,
      'current_user',
      user.toJson(),
    );
  }

  Future<AChatUser?> getCurrentUser() async {
    final data = await _storage.getValue<Map<String, dynamic>>(
      _usersBox,
      'current_user',
    );

    if (data != null) {
      try {
        return AChatUser.fromJson(data);
      } catch (e) {
        if (kDebugMode) {
          print('Error parsing current user: $e');
        }
        return null;
      }
    }
    return null;
  }

  Future<AChatUser?> getUser(String userId) async {
    final data = await _storage.getValue<Map<String, dynamic>>(
      _usersBox,
      userId,
    );

    if (data != null) {
      try {
        return AChatUser.fromJson(data);
      } catch (e) {
        if (kDebugMode) {
          print('Error parsing user $userId: $e');
        }
        return null;
      }
    }
    return null;
  }

  Future<void> clearCurrentUser() async {
    await _storage.deleteKey(_usersBox, 'current_user');
  }

  /// Draft Messages Storage
  Future<void> storeDraft(String chatId, String content) async {
    if (content.trim().isEmpty) {
      await _storage.deleteKey(_draftsBox, chatId);
    } else {
      await _storage.putValue(_draftsBox, chatId, {
        'content': content,
        'timestamp': DateTime.now().toIso8601String(),
      });
    }
  }

  Future<String?> getDraft(String chatId) async {
    final data = await _storage.getValue<Map<String, dynamic>>(
      _draftsBox,
      chatId,
    );

    if (data != null) {
      return data['content'] as String?;
    }
    return null;
  }

  Future<void> clearDraft(String chatId) async {
    await _storage.deleteKey(_draftsBox, chatId);
  }

  Future<void> clearAllDrafts() async {
    await _storage.clearBox(_draftsBox);
  }

  /// Settings Storage
  Future<void> storeUserPreferences(AChatUserPreferences preferences) async {
    await _storage.putValue(
      _settingsBox,
      'user_preferences',
      preferences.toJson(),
    );
  }

  Future<AChatUserPreferences?> getUserPreferences() async {
    final data = await _storage.getValue<Map<String, dynamic>>(
      _settingsBox,
      'user_preferences',
    );

    if (data != null) {
      try {
        return AChatUserPreferences.fromJson(data);
      } catch (e) {
        if (kDebugMode) {
          print('Error parsing user preferences: $e');
        }
        return null;
      }
    }
    return null;
  }

  Future<void> storeSetting(String key, dynamic value) async {
    await _storage.putValue(_settingsBox, key, value);
  }

  Future<T?> getSetting<T>(String key, {T? defaultValue}) async {
    return await _storage.getValue<T>(_settingsBox, key, defaultValue: defaultValue);
  }

  /// Offline Queue Storage
  Future<void> addToOfflineQueue(Map<String, dynamic> operation) async {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final key = 'op_$timestamp';

    operation['timestamp'] = timestamp;
    operation['id'] = key;

    await _storage.putValue(_offlineQueueBox, key, operation);
  }

  Future<List<Map<String, dynamic>>> getOfflineQueue() async {
    final allData = await _storage.getAllFromBox(_offlineQueueBox);
    final operations = <Map<String, dynamic>>[];

    for (final entry in allData.entries) {
      try {
        final operation = entry.value as Map<String, dynamic>;
        operations.add(operation);
      } catch (e) {
        if (kDebugMode) {
          print('Error parsing offline operation ${entry.key}: $e');
        }
      }
    }

    // Sort by timestamp
    operations.sort((a, b) => (a['timestamp'] as int).compareTo(b['timestamp'] as int));
    return operations;
  }

  Future<void> removeFromOfflineQueue(String operationId) async {
    await _storage.deleteKey(_offlineQueueBox, operationId);
  }

  Future<void> clearOfflineQueue() async {
    await _storage.clearBox(_offlineQueueBox);
  }

  /// Authentication Storage
  Future<void> storeAuthTokens({
    required String accessToken,
    required String refreshToken,
    required DateTime expiresAt,
    String? websocketUrl,
  }) async {
    await _storage.putValue(_settingsBox, 'auth_tokens', {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'expires_at': expiresAt.toIso8601String(),
      'websocket_url': websocketUrl,
      'stored_at': DateTime.now().toIso8601String(),
    });
  }

  Future<Map<String, dynamic>?> getAuthTokens() async {
    return await _storage.getValue<Map<String, dynamic>>(
      _settingsBox,
      'auth_tokens',
    );
  }

  Future<void> clearAuthTokens() async {
    await _storage.deleteKey(_settingsBox, 'auth_tokens');
  }

  Future<bool> isTokenExpired() async {
    final tokens = await getAuthTokens();
    if (tokens == null) return true;

    final expiresAt = DateTime.parse(tokens['expires_at'] as String);
    return DateTime.now().isAfter(expiresAt);
  }

  /// Search History Storage
  Future<void> storeSearchQuery(String query) async {
    final history = await getSearchHistory();

    // Remove if already exists to avoid duplicates
    history.remove(query);

    // Add to beginning
    history.insert(0, query);

    // Keep only last 50 searches
    if (history.length > 50) {
      history.removeRange(50, history.length);
    }

    await _storage.putValue(_settingsBox, 'search_history', history);
  }

  Future<List<String>> getSearchHistory() async {
    final history = await _storage.getValue<List<dynamic>>(
      _settingsBox,
      'search_history',
      defaultValue: <dynamic>[],
    );

    return history?.cast<String>() ?? [];
  }

  Future<void> clearSearchHistory() async {
    await _storage.deleteKey(_settingsBox, 'search_history');
  }

  /// Typing Users Cache
  Future<void> updateTypingUsers(String chatId, List<String> userIds) async {
    await _storage.putValue(_settingsBox, 'typing_$chatId', {
      'users': userIds,
      'updated_at': DateTime.now().toIso8601String(),
    });
  }

  Future<List<String>> getTypingUsers(String chatId) async {
    final data = await _storage.getValue<Map<String, dynamic>>(
      _settingsBox,
      'typing_$chatId',
    );

    if (data != null) {
      final updatedAt = DateTime.parse(data['updated_at'] as String);
      // Consider typing data stale after 10 seconds
      if (DateTime.now().difference(updatedAt).inSeconds < 10) {
        return List<String>.from(data['users'] as List);
      }
    }
    return [];
  }

  /// Statistics and Analytics
  Future<Map<String, dynamic>> getStorageStats() async {
    final conversationCount = (await _storage.getAllFromBox(_conversationsBox)).length;
    final messageCount = (await _storage.getAllFromBox(_messagesBox)).length;
    final userCount = (await _storage.getAllFromBox(_usersBox)).length;
    final draftCount = (await _storage.getAllFromBox(_draftsBox)).length;
    final offlineQueueCount = (await _storage.getAllFromBox(_offlineQueueBox)).length;

    return {
      'conversations': conversationCount,
      'messages': messageCount,
      'users': userCount,
      'drafts': draftCount,
      'offline_queue': offlineQueueCount,
      'total_items': conversationCount + messageCount + userCount + draftCount + offlineQueueCount,
      'last_updated': DateTime.now().toIso8601String(),
    };
  }

  /// Cleanup and Maintenance
  Future<void> cleanupOldData({Duration? maxAge}) async {
    final cutoffDate = DateTime.now().subtract(maxAge ?? const Duration(days: 30));

    // Clean up old messages
    final allMessages = await _storage.getAllFromBox(_messagesBox);
    for (final entry in allMessages.entries) {
      try {
        final message = AChatMessage.fromJson(entry.value as Map<String, dynamic>);
        if (message.timestamp.isBefore(cutoffDate)) {
          await _storage.deleteKey(_messagesBox, entry.key as String);
        }
      } catch (e) {
        // Remove corrupted entries
        await _storage.deleteKey(_messagesBox, entry.key as String);
      }
    }

    // Clean up old drafts
    final allDrafts = await _storage.getAllFromBox(_draftsBox);
    for (final entry in allDrafts.entries) {
      try {
        final data = entry.value as Map<String, dynamic>;
        final timestamp = DateTime.parse(data['timestamp'] as String);
        if (timestamp.isBefore(cutoffDate)) {
          await _storage.deleteKey(_draftsBox, entry.key as String);
        }
      } catch (e) {
        // Remove corrupted entries
        await _storage.deleteKey(_draftsBox, entry.key as String);
      }
    }

    if (kDebugMode) {
      print('AChat storage cleanup completed');
    }
  }

  Future<void> clearAllData() async {
    await Future.wait([
      _storage.clearBox(_conversationsBox),
      _storage.clearBox(_messagesBox),
      _storage.clearBox(_usersBox),
      _storage.clearBox(_draftsBox),
      _storage.clearBox(_settingsBox),
      _storage.clearBox(_offlineQueueBox),
    ]);

    if (kDebugMode) {
      print('All AChat data cleared');
    }
  }

  /// Backup and Export
  Future<Map<String, dynamic>> exportData() async {
    final conversations = await _storage.getAllFromBox(_conversationsBox);
    final messages = await _storage.getAllFromBox(_messagesBox);
    final users = await _storage.getAllFromBox(_usersBox);
    final settings = await _storage.getAllFromBox(_settingsBox);

    return {
      'conversations': conversations,
      'messages': messages,
      'users': users,
      'settings': settings,
      'exported_at': DateTime.now().toIso8601String(),
      'version': '1.0.0',
    };
  }

  Future<void> importData(Map<String, dynamic> data) async {
    try {
      // Clear existing data
      await clearAllData();

      // Import conversations
      final conversations = data['conversations'] as Map<String, dynamic>? ?? {};
      for (final entry in conversations.entries) {
        await _storage.putValue(_conversationsBox, entry.key, entry.value);
      }

      // Import messages
      final messages = data['messages'] as Map<String, dynamic>? ?? {};
      for (final entry in messages.entries) {
        await _storage.putValue(_messagesBox, entry.key, entry.value);
      }

      // Import users
      final users = data['users'] as Map<String, dynamic>? ?? {};
      for (final entry in users.entries) {
        await _storage.putValue(_usersBox, entry.key, entry.value);
      }

      // Import settings (excluding sensitive data like auth tokens)
      final settings = data['settings'] as Map<String, dynamic>? ?? {};
      for (final entry in settings.entries) {
        if (entry.key != 'auth_tokens') {
          await _storage.putValue(_settingsBox, entry.key, entry.value);
        }
      }

      if (kDebugMode) {
        print('AChat data import completed');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error importing AChat data: $e');
      }
      rethrow;
    }
  }
}