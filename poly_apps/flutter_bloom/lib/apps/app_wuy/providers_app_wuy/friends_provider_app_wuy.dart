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

import 'package:flutter/foundation.dart';
import '../models_app_wuy/friend_model_app_wuy.dart';
import '../services_app_wuy/wuy_unified_service.dart';

class FriendsProviderAppWuy extends ChangeNotifier {
  List<FriendModelAppWuy> _friends = [];
  bool _isLoading = false;
  String? _error;
  final WuyUnifiedService _dataManager = WuyUnifiedService();

  List<FriendModelAppWuy> get friends => _friends;
  bool get isLoading => _isLoading;
  String? get error => _error;

  int get totalUnreadCount {
    return _friends.fold(0, (sum, friend) => sum + friend.unreadMessageCount);
  }

  List<FriendModelAppWuy> get monitoredFriends {
    return _friends.where((friend) => friend.isMonitoring).toList();
  }

  List<FriendModelAppWuy> get onlineFriends {
    return _friends.where((friend) => friend.isOnline).toList();
  }

  Future<void> loadFriends() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _dataManager.getFriends();
      _friends = response.data ?? [];
      _error = null;
    } catch (e) {
      _error = e.toString();
      debugPrint('Error loading friends: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> toggleMonitoring(String friendId) async {
    final friendIndex = _friends.indexWhere((f) => f.id == friendId);
    if (friendIndex == -1) return;

    final friend = _friends[friendIndex];
    final updatedFriend = friend.copyWith(isMonitoring: !friend.isMonitoring);
    _friends[friendIndex] = updatedFriend;
    notifyListeners();

    try {
      await _dataManager.updateFriendMonitoringStatus(
        friendId,
        updatedFriend.isMonitoring,
      );
    } catch (e) {
      _friends[friendIndex] = friend;
      notifyListeners();
      debugPrint('Error toggling monitoring: $e');
      rethrow;
    }
  }

  void updateFriend(FriendModelAppWuy updatedFriend) {
    final index = _friends.indexWhere((f) => f.id == updatedFriend.id);
    if (index != -1) {
      _friends[index] = updatedFriend;
      notifyListeners();
    }
  }

  void updateUnreadCount(String friendId, int count) {
    final index = _friends.indexWhere((f) => f.id == friendId);
    if (index != -1) {
      _friends[index] = _friends[index].copyWith(unreadMessageCount: count);
      notifyListeners();
    }
  }

  void markMessagesAsRead(String friendId) {
    updateUnreadCount(friendId, 0);
  }

  void incrementUnreadCount(String friendId) {
    final index = _friends.indexWhere((f) => f.id == friendId);
    if (index != -1) {
      final currentCount = _friends[index].unreadMessageCount;
      _friends[index] =
          _friends[index].copyWith(unreadMessageCount: currentCount + 1);
      notifyListeners();
    }
  }

  void updateLastMessage(String friendId, String message, DateTime time) {
    final index = _friends.indexWhere((f) => f.id == friendId);
    if (index != -1) {
      _friends[index] = _friends[index].copyWith(
        lastMessage: message,
        lastMessageTime: time,
      );
      notifyListeners();
    }
  }

  void updateLocation(
      String friendId, DateTime locationTime, Map<String, dynamic> location) {
    final index = _friends.indexWhere((f) => f.id == friendId);
    if (index != -1) {
      _friends[index] = _friends[index].copyWith(
        lastLocationTime: locationTime,
        lastLocation: location,
      );
      notifyListeners();
    }
  }

  void updateOnlineStatus(String friendId, bool isOnline) {
    final index = _friends.indexWhere((f) => f.id == friendId);
    if (index != -1) {
      _friends[index] = _friends[index].copyWith(
        isOnline: isOnline,
        lastSeen: isOnline ? null : DateTime.now(),
      );
      notifyListeners();
    }
  }

  FriendModelAppWuy? getFriendById(String friendId) {
    try {
      return _friends.firstWhere((f) => f.id == friendId);
    } catch (e) {
      return null;
    }
  }

  void clear() {
    _friends = [];
    _isLoading = false;
    _error = null;
    notifyListeners();
  }
}
