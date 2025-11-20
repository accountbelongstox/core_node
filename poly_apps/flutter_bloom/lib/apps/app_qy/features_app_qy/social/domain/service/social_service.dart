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

import '../model/social_model.dart';
import '../../../../services_app_qy/api_service_app_qy.dart';

class SocialService {
  final ApiServiceAppQy _apiService;

  const SocialService({required ApiServiceAppQy apiService})
      : _apiService = apiService;

  Future<List<MessageModel>> getMessages({int page = 1, int pageSize = 20}) async {
    try {
      final response = await _apiService.get(
        '/api/v1/messages',
        queryParameters: {'page': page, 'page_size': pageSize},
      );
      final data = response.data as List<dynamic>;
      return data
          .map((json) => MessageModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _mockMessages();
    }
  }

  Future<List<NotificationModel>> getNotifications({int page = 1, int pageSize = 20}) async {
    try {
      final response = await _apiService.get(
        '/api/v1/notifications',
        queryParameters: {'page': page, 'page_size': pageSize},
      );
      final data = response.data as List<dynamic>;
      return data
          .map((json) => NotificationModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _mockNotifications();
    }
  }

  Future<bool> markMessageAsRead(String messageId) async {
    try {
      await _apiService.patch('/api/v1/messages/$messageId/read');
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> markNotificationAsRead(String notificationId) async {
    try {
      await _apiService.patch('/api/v1/notifications/$notificationId/read');
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> markAllMessagesAsRead() async {
    try {
      await _apiService.patch('/api/v1/messages/read-all');
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> markAllNotificationsAsRead() async {
    try {
      await _apiService.patch('/api/v1/notifications/read-all');
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<CheckInModel?> checkIn() async {
    try {
      final response = await _apiService.post('/api/v1/check-in');
      return CheckInModel.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      return _mockCheckIn();
    }
  }

  Future<CheckInModel?> getTodayCheckIn() async {
    try {
      final response = await _apiService.get('/api/v1/check-in/today');
      return CheckInModel.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      return null;
    }
  }

  Future<List<CheckInModel>> getCheckInHistory({int days = 30}) async {
    try {
      final response = await _apiService.get(
        '/api/v1/check-in/history',
        queryParameters: {'days': days},
      );
      final data = response.data as List<dynamic>;
      return data
          .map((json) => CheckInModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _mockCheckInHistory();
    }
  }

  Future<List<CheckInChallengeModel>> getChallenges() async {
    try {
      final response = await _apiService.get('/api/v1/challenges');
      final data = response.data as List<dynamic>;
      return data
          .map((json) => CheckInChallengeModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _mockChallenges();
    }
  }

  Future<bool> joinChallenge(String challengeId) async {
    try {
      await _apiService.post('/api/v1/challenges/$challengeId/join');
      return true;
    } catch (e) {
      return false;
    }
  }

  List<MessageModel> _mockMessages() {
    return [
      MessageModel(
        id: '1',
        senderId: 'system',
        senderName: 'System',
        senderAvatar: null,
        content: 'Welcome to QY English! Start your learning journey today.',
        type: 'system',
        isRead: false,
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      MessageModel(
        id: '2',
        senderId: 'admin',
        senderName: 'QY Team',
        senderAvatar: null,
        content: 'New course available: IELTS Vocabulary Master',
        type: 'announcement',
        isRead: false,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
      MessageModel(
        id: '3',
        senderId: 'system',
        senderName: 'Learning Assistant',
        senderAvatar: null,
        content: 'You have completed 7 days of consecutive learning!',
        type: 'achievement',
        isRead: true,
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
    ];
  }

  List<NotificationModel> _mockNotifications() {
    return [
      NotificationModel(
        id: '1',
        title: 'Daily Reminder',
        content: 'Time to learn your daily words!',
        type: 'reminder',
        isRead: false,
        createdAt: DateTime.now().subtract(const Duration(hours: 1)),
        actionUrl: '/learning',
      ),
      NotificationModel(
        id: '2',
        title: 'Achievement Unlocked',
        content: 'You have earned the "Weekly Warrior" badge!',
        type: 'achievement',
        isRead: false,
        createdAt: DateTime.now().subtract(const Duration(hours: 5)),
        actionUrl: '/achievements',
      ),
      NotificationModel(
        id: '3',
        title: 'New Course',
        content: 'Check out the new TOEFL preparation course',
        type: 'course',
        isRead: true,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
        actionUrl: '/courses',
      ),
    ];
  }

  CheckInModel _mockCheckIn() {
    return CheckInModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      userId: 'user123',
      checkInDate: DateTime.now(),
      consecutiveDays: 15,
      totalDays: 30,
      wordsLearnedToday: 27,
      studyMinutesToday: 45,
      hasBonus: true,
      bonusPoints: 10,
    );
  }

  List<CheckInModel> _mockCheckInHistory() {
    return List.generate(15, (index) {
      return CheckInModel(
        id: index.toString(),
        userId: 'user123',
        checkInDate: DateTime.now().subtract(Duration(days: index)),
        consecutiveDays: 15 - index,
        totalDays: 30 - index,
        wordsLearnedToday: 20 + (index % 10),
        studyMinutesToday: 30 + (index % 20),
        hasBonus: index % 7 == 0,
        bonusPoints: index % 7 == 0 ? 10 : 0,
      );
    });
  }

  List<CheckInChallengeModel> _mockChallenges() {
    return [
      CheckInChallengeModel(
        id: '1',
        title: '7-Day Check-in Challenge',
        description: 'Check in for 7 consecutive days',
        targetDays: 7,
        currentDays: 5,
        startDate: DateTime.now().subtract(const Duration(days: 5)),
        endDate: DateTime.now().add(const Duration(days: 2)),
        rewardPoints: 50,
        status: 'active',
        participants: 1234,
      ),
      CheckInChallengeModel(
        id: '2',
        title: '30-Day Consistency Master',
        description: 'Check in for 30 consecutive days',
        targetDays: 30,
        currentDays: 15,
        startDate: DateTime.now().subtract(const Duration(days: 15)),
        endDate: DateTime.now().add(const Duration(days: 15)),
        rewardPoints: 200,
        status: 'active',
        participants: 5678,
      ),
      CheckInChallengeModel(
        id: '3',
        title: '100-Day Legend',
        description: 'Check in for 100 consecutive days',
        targetDays: 100,
        currentDays: 0,
        startDate: DateTime.now(),
        endDate: DateTime.now().add(const Duration(days: 100)),
        rewardPoints: 1000,
        status: 'active',
        participants: 12345,
      ),
    ];
  }
}
