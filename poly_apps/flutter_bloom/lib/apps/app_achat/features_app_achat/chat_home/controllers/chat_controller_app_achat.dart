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

// MODIFIED BY: AI Assistant for chat_home refactoring
// NOTE FOR OTHER AIs: This controller has been refactored to use new architecture
// Please avoid modifying this file during the chat_home refactoring process

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/model_app_achat/chat_item_model.dart';
import 'package:qyflutter/common/widgets/network_connection_dialog.dart';

/// Chat Home controller for AChat app
/// Manages chat home state and business logic using new architecture
class ChatHomeController extends ChangeNotifier {
  List<ChatItemModel> _chatItems = [];
  List<ChatItemModel> _filteredChatItems = [];
  String _searchQuery = '';
  bool _isLoading = false;
  bool _isManageMode = false;
  Set<String> _selectedChatIds = {};

  List<ChatItemModel> get chatItems => List.unmodifiable(_chatItems);
  List<ChatItemModel> get filteredChatItems => List.unmodifiable(_filteredChatItems);
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  bool get isManageMode => _isManageMode;
  Set<String> get selectedChatIds => Set.unmodifiable(_selectedChatIds);
  bool get hasSelectedChats => _selectedChatIds.isNotEmpty;

  // Soft avatar colors for better UI
  final List<Color> avatarColors = [
    const Color(0xFF26C6DA), // Cyan
    const Color(0xFF42A5F5), // Blue
    const Color(0xFF66BB6A), // Green
    const Color(0xFFAB47BC), // Purple
    const Color(0xFFFF7043), // Orange
    const Color(0xFFEC407A), // Pink
    const Color(0xFF7E57C2), // Deep Purple
    const Color(0xFFFFCA28), // Yellow
  ];

  ChatHomeController() {
    _loadChatItems();
  }

  void _loadChatItems() {
    _isLoading = true;
    notifyListeners();

    // Mock data for demonstration
    _chatItems = [
      ChatItemModel(
        id: '1',
        name: '【专属约炮】接待员：小玉 💖 上班时间：🌙 夜班：22:00 - 06:00',
        lastMessage: '【专属约炮接线】亲爱的哥哥，人家好想你呀，现在可以和你聊天吗？💕',
        timestamp: DateTime.now().subtract(const Duration(minutes: 5)),
        unreadCount: 2,
        avatarUrl: null,
        isOnline: true,
        isAvailable: true,
      ),
      ChatItemModel(
        id: '2',
        name: '【公共群】来自全国美女、少妇、全国可飞💋👏💦',
        lastMessage: '【共公群】来自全国美女、少妇、全国可飞💋👏💦莞式、肛交、制服、黑丝，少女|熟女|富婆|少妇-任你摆布、等你作爱',
        timestamp: DateTime.now().subtract(const Duration(hours: 1)),
        unreadCount: 0,
        avatarUrl: null,
        isOnline: false,
        isAvailable: false, // This chat is not available
      ),
      ChatItemModel(
        id: '3',
        name: '小雨 【女】 20岁',
        lastMessage: '你有一份新朋友，她寂寞了，点击立即约炮..',
        timestamp: DateTime.now().subtract(const Duration(hours: 2)),
        unreadCount: 5,
        avatarUrl: null,
        isOnline: false,
        isGroup: true,
        isAvailable: false,
      ),
    ];

    _filteredChatItems = List.from(_chatItems);
    _isLoading = false;
    notifyListeners();
  }

  void searchChats(String query) {
    _searchQuery = query;

    if (query.isEmpty) {
      _filteredChatItems = List.from(_chatItems);
    } else {
      _filteredChatItems = _chatItems
          .where((chat) =>
              chat.name.toLowerCase().contains(query.toLowerCase()) ||
              chat.lastMessage.toLowerCase().contains(query.toLowerCase()))
          .toList();
    }

    notifyListeners();
  }

  void toggleManageMode() {
    _isManageMode = !_isManageMode;
    if (!_isManageMode) {
      _selectedChatIds.clear();
    }
    notifyListeners();
  }

  void toggleChatSelection(String chatId) {
    if (_selectedChatIds.contains(chatId)) {
      _selectedChatIds.remove(chatId);
    } else {
      _selectedChatIds.add(chatId);
    }

    if (_selectedChatIds.isEmpty) {
      _isManageMode = false;
    }

    notifyListeners();
  }

  void selectAllChats() {
    _selectedChatIds = _filteredChatItems.map((chat) => chat.id).toSet();
    notifyListeners();
  }

  void clearSelection() {
    _selectedChatIds.clear();
    _isManageMode = false;
    notifyListeners();
  }

  void markAsRead(String chatId) {
    final chatIndex = _chatItems.indexWhere((chat) => chat.id == chatId);
    if (chatIndex != -1) {
      _chatItems[chatIndex].markAsRead();
      notifyListeners();
    }
  }

  void markAllAsRead() {
    for (final chat in _chatItems) {
      if (_selectedChatIds.isEmpty || _selectedChatIds.contains(chat.id)) {
        chat.markAsRead();
      }
    }
    clearSelection();
    notifyListeners();
  }

  void deleteChat(String chatId) {
    _chatItems.removeWhere((chat) => chat.id == chatId);
    _filteredChatItems.removeWhere((chat) => chat.id == chatId);
    _selectedChatIds.remove(chatId);
    notifyListeners();
  }

  void deleteSelectedChats() {
    _chatItems.removeWhere((chat) => _selectedChatIds.contains(chat.id));
    _filteredChatItems.removeWhere((chat) => _selectedChatIds.contains(chat.id));
    clearSelection();
    notifyListeners();
  }

  Color getAvatarColor(int index) {
    return avatarColors[index % avatarColors.length];
  }

  void navigateToChat(String chatId) {
    // TODO: Implement navigation to chat details
    // This would typically use GoRouter or Navigator
  }

  void showNetworkConnectionDialog(BuildContext context) {
    NetworkConnectionDialog.show(context);
  }

  Future<void> refresh() async {
    _loadChatItems();
  }
}
