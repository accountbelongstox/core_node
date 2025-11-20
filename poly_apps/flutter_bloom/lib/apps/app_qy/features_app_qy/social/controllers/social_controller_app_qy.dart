// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

library;

import 'package:flutter/foundation.dart';
import '../domain/model/social_model.dart';
import '../domain/service/social_service.dart';

class SocialControllerAppQy extends ChangeNotifier {
  final SocialService _socialService;
  List<MessageModel> _messages;
  List<NotificationModel> _notifications;
  CheckInModel? _todayCheckIn;
  List<CheckInModel> _checkInHistory;
  List<CheckInChallengeModel> _challenges;
  bool _isLoading;
  String? _errorMessage;

  SocialControllerAppQy({required SocialService socialService})
      : _socialService = socialService,
        _messages = [],
        _notifications = [],
        _checkInHistory = [],
        _challenges = [],
        _isLoading = false;

  List<MessageModel> get messages => _messages;
  List<NotificationModel> get notifications => _notifications;
  CheckInModel? get todayCheckIn => _todayCheckIn;
  List<CheckInModel> get checkInHistory => _checkInHistory;
  List<CheckInChallengeModel> get challenges => _challenges;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  int get unreadMessageCount =>
      _messages.where((m) => !m.isRead).length;

  int get unreadNotificationCount =>
      _notifications.where((n) => !n.isRead).length;

  bool get hasCheckedInToday => _todayCheckIn != null;

  List<CheckInChallengeModel> get activeChallenges =>
      _challenges.where((c) => c.isActive).toList();

  Future<void> loadMessages() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _messages = await _socialService.getMessages();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadNotifications() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _notifications = await _socialService.getNotifications();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> markMessageAsRead(String messageId) async {
    try {
      final success = await _socialService.markMessageAsRead(messageId);
      if (success) {
        final index = _messages.indexWhere((m) => m.id == messageId);
        if (index != -1) {
          _messages[index] = _messages[index].copyWith(isRead: true);
          notifyListeners();
        }
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
  }

  Future<void> markNotificationAsRead(String notificationId) async {
    try {
      final success = await _socialService.markNotificationAsRead(notificationId);
      if (success) {
        final index = _notifications.indexWhere((n) => n.id == notificationId);
        if (index != -1) {
          _notifications = List.from(_notifications);
          notifyListeners();
        }
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
  }

  Future<void> markAllMessagesAsRead() async {
    try {
      final success = await _socialService.markAllMessagesAsRead();
      if (success) {
        _messages = _messages.map((m) => m.copyWith(isRead: true)).toList();
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
  }

  Future<void> markAllNotificationsAsRead() async {
    try {
      final success = await _socialService.markAllNotificationsAsRead();
      if (success) {
        _notifications = List.from(_notifications);
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
    }
  }

  Future<bool> checkIn() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _todayCheckIn = await _socialService.checkIn();
      await loadCheckInHistory();
      return _todayCheckIn != null;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadTodayCheckIn() async {
    try {
      _todayCheckIn = await _socialService.getTodayCheckIn();
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
    }
  }

  Future<void> loadCheckInHistory() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _checkInHistory = await _socialService.getCheckInHistory();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadChallenges() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _challenges = await _socialService.getChallenges();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> joinChallenge(String challengeId) async {
    try {
      final success = await _socialService.joinChallenge(challengeId);
      if (success) {
        await loadChallenges();
      }
      return success;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    }
  }

  Future<void> loadAllData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.wait([
        loadMessages(),
        loadNotifications(),
        loadTodayCheckIn(),
        loadCheckInHistory(),
        loadChallenges(),
      ]);
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    super.dispose();
  }
}
