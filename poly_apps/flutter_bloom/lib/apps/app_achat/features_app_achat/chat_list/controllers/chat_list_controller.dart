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

// Created by: Kiro AI Assistant
// Date: Current refactoring session
// Purpose: New controller following Flutter guide standards
// Note to other AIs: This controller manages chat list state and business logic

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_list/domain/model/chat_list_model.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_list/domain/service/chat_list_service.dart';


class ChatListController extends ChangeNotifier {
  final ChatListService _chatListService = ChatListService();
  // Note: SettingsController requires initialization with dependencies
  // For now, commenting out until proper dependency injection is set up
  // final SettingsController _settingsController = SettingsController();

  List<ChatItemModel> _allChats = [];
  List<ChatItemModel> _filteredChats = [];
  String _searchQuery = '';
  bool _isLoading = false;
  bool _isSearching = false;
  String? _error;
  bool _isManageMode = false;
  Set<String> _selectedChatIds = {};

  // Getters
  List<ChatItemModel> get allChats => _allChats;
  List<ChatItemModel> get filteredChats => _filteredChats;
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  bool get isSearching => _isSearching;
  String? get error => _error;
  bool get isManageMode => _isManageMode;
  Set<String> get selectedChatIds => _selectedChatIds;
  bool get hasSelectedChats => _selectedChatIds.isNotEmpty;
  int get totalUnreadCount => _chatListService.getTotalUnreadCount(_allChats);

  // Initialize controller
  Future<void> initialize() async {
    await loadChats();
  }

  // Load chats from service
  Future<void> loadChats() async {
    _setLoading(true);
    _setError(null);

    try {
      final chats = await _chatListService.getChats();
      _allChats = _chatListService.sortChatsByPriority(chats);
      _applyCurrentFilter();
    } catch (e) {
      _setError('Failed to load chats: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  // Refresh chats
  Future<void> refreshChats() async {
    await loadChats();
  }

  // Search functionality
  void searchChats(String query) {
    _searchQuery = query;
    _setSearching(query.isNotEmpty);
    _applyCurrentFilter();
  }

  void clearSearch() {
    _searchQuery = '';
    _setSearching(false);
    _applyCurrentFilter();
  }

  // Apply current filter (search + sorting)
  void _applyCurrentFilter() {
    if (_searchQuery.isEmpty) {
      _filteredChats = List.from(_allChats);
    } else {
      _filteredChats = _chatListService.searchChats(_allChats, _searchQuery);
    }
    notifyListeners();
  }

  // Manage mode functionality
  void toggleManageMode() {
    _isManageMode = !_isManageMode;
    if (!_isManageMode) {
      _selectedChatIds.clear();
    }
    notifyListeners();
  }

  void exitManageMode() {
    _isManageMode = false;
    _selectedChatIds.clear();
    notifyListeners();
  }

  void toggleChatSelection(String chatId) {
    if (_selectedChatIds.contains(chatId)) {
      _selectedChatIds.remove(chatId);
    } else {
      _selectedChatIds.add(chatId);
    }
    notifyListeners();
  }

  void selectAllChats() {
    _selectedChatIds = _filteredChats.map((chat) => chat.id).toSet();
    notifyListeners();
  }

  void deselectAllChats() {
    _selectedChatIds.clear();
    notifyListeners();
  }

  // Chat actions
  Future<void> markChatAsRead(String chatId) async {
    try {
      await _chatListService.markChatAsRead(chatId);
      _updateChatInList(chatId, (chat) => chat.copyWith(unreadCount: 0));
    } catch (e) {
      _setError('Failed to mark chat as read: ${e.toString()}');
    }
  }

  Future<void> markSelectedChatsAsRead() async {
    for (final chatId in _selectedChatIds) {
      await markChatAsRead(chatId);
    }
    exitManageMode();
  }

  Future<void> pinChat(String chatId) async {
    try {
      await _chatListService.pinChat(chatId);
      _updateChatInList(chatId, (chat) => chat.copyWith(status: ChatItemStatus.pinned));
      _reorderChats();
    } catch (e) {
      _setError('Failed to pin chat: ${e.toString()}');
    }
  }

  Future<void> muteChat(String chatId) async {
    try {
      await _chatListService.muteChat(chatId);
      _updateChatInList(chatId, (chat) => chat.copyWith(status: ChatItemStatus.muted));
    } catch (e) {
      _setError('Failed to mute chat: ${e.toString()}');
    }
  }

  Future<void> deleteChat(String chatId) async {
    try {
      await _chatListService.deleteChat(chatId);
      _allChats.removeWhere((chat) => chat.id == chatId);
      _applyCurrentFilter();
    } catch (e) {
      _setError('Failed to delete chat: ${e.toString()}');
    }
  }

  Future<void> deleteSelectedChats() async {
    for (final chatId in _selectedChatIds) {
      await deleteChat(chatId);
    }
    exitManageMode();
  }

  // Navigation actions
  void navigateToChat(String chatId) {
    // Mark as read when opening chat
    markChatAsRead(chatId);
  }

  void navigateToNewGroup() {
    // Handle new group navigation
  }

  void navigateToAddFriend() {
    // Handle add friend navigation
  }

  void toggleAppLock() {
    // Handle app lock toggle
  }

  // Filter methods
  List<ChatItemModel> getUnreadChats() {
    return _chatListService.getUnreadChats(_allChats);
  }

  List<ChatItemModel> getPinnedChats() {
    return _chatListService.getPinnedChats(_allChats);
  }

  List<ChatItemModel> getChatsByType(ChatItemType type) {
    return _chatListService.getChatsByType(_allChats, type);
  }

  // Private helper methods
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setSearching(bool searching) {
    _isSearching = searching;
    notifyListeners();
  }

  void _setError(String? error) {
    _error = error;
    notifyListeners();
  }

  void _updateChatInList(String chatId, ChatItemModel Function(ChatItemModel) updater) {
    final index = _allChats.indexWhere((chat) => chat.id == chatId);
    if (index != -1) {
      _allChats[index] = updater(_allChats[index]);
      _applyCurrentFilter();
    }
  }

  void _reorderChats() {
    _allChats = _chatListService.sortChatsByPriority(_allChats);
    _applyCurrentFilter();
  }


}