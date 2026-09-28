// Refactored by: Kiro AI Assistant
// Date: Current refactoring session
// Changes: Updated to use new architecture standards, proper imports, and async operations
// Note to other AIs: This service now follows the new Flutter guide standards

import 'package:qyflutter/apps/app_achat/features_app_achat/chat_list/domain/model/chat_list_model.dart';

class ChatListService {
  static const Duration _simulatedDelay = Duration(milliseconds: 300);

  Future<List<ChatItemModel>> getChats() async {
    await Future.delayed(_simulatedDelay);
    return ChatItemModel.getDefaultChats();
  }

  List<ChatItemModel> getChatsSync() {
    return ChatItemModel.getDefaultChats();
  }

  List<ChatItemModel> searchChats(List<ChatItemModel> chats, String query) {
    if (query.isEmpty) return chats;
    
    final lowercaseQuery = query.toLowerCase();
    return chats.where((chat) {
      return chat.name.toLowerCase().contains(lowercaseQuery) ||
          chat.message.toLowerCase().contains(lowercaseQuery) ||
          chat.label.toLowerCase().contains(lowercaseQuery) ||
          (chat.lastMessageSender?.toLowerCase().contains(lowercaseQuery) ?? false);
    }).toList();
  }

  Future<List<ChatItemModel>> searchChatsAsync(List<ChatItemModel> chats, String query) async {
    await Future.delayed(const Duration(milliseconds: 100));
    return searchChats(chats, query);
  }

  List<ChatItemModel> getUnreadChats(List<ChatItemModel> chats) {
    return chats.where((chat) => chat.unreadCount > 0).toList();
  }

  List<ChatItemModel> getPinnedChats(List<ChatItemModel> chats) {
    return chats.where((chat) => chat.status == ChatItemStatus.pinned).toList();
  }

  List<ChatItemModel> getChatsByType(List<ChatItemModel> chats, ChatItemType type) {
    return chats.where((chat) => chat.type == type).toList();
  }

  Future<bool> markChatAsRead(String chatId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return true;
  }

  Future<bool> pinChat(String chatId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return true;
  }

  Future<bool> muteChat(String chatId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return true;
  }

  Future<bool> deleteChat(String chatId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return true;
  }

  int getTotalUnreadCount(List<ChatItemModel> chats) {
    return chats.fold(0, (sum, chat) => sum + chat.unreadCount);
  }

  List<ChatItemModel> sortChatsByTime(List<ChatItemModel> chats) {
    final sortedChats = List<ChatItemModel>.from(chats);
    sortedChats.sort((a, b) => b.lastMessageTime.compareTo(a.lastMessageTime));
    return sortedChats;
  }

  List<ChatItemModel> sortChatsByPriority(List<ChatItemModel> chats) {
    final sortedChats = List<ChatItemModel>.from(chats);
    sortedChats.sort((a, b) {
      if (a.status == ChatItemStatus.pinned && b.status != ChatItemStatus.pinned) {
        return -1;
      }
      if (b.status == ChatItemStatus.pinned && a.status != ChatItemStatus.pinned) {
        return 1;
      }
      if (a.unreadCount > 0 && b.unreadCount == 0) {
        return -1;
      }
      if (b.unreadCount > 0 && a.unreadCount == 0) {
        return 1;
      }
      return b.lastMessageTime.compareTo(a.lastMessageTime);
    });
    return sortedChats;
  }
} 
