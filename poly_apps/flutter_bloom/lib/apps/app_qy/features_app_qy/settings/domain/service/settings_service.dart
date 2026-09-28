library;

import '../model/settings_model.dart';
import '../../../../services_app_qy/api_service_app_qy.dart';

class SettingsService {
  final ApiServiceAppQy _apiService;

  const SettingsService({required ApiServiceAppQy apiService})
      : _apiService = apiService;

  Future<AppSettingsModel> getSettings() async {
    try {
      final response = await _apiService.get('/api/v1/settings');
      final data = response['data'] ?? response;
      return AppSettingsModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return AppSettingsModel.defaultSettings();
    }
  }

  Future<bool> updateSettings(AppSettingsModel settings) async {
    try {
      await _apiService.put(
        '/api/v1/settings',
        data: settings.toJson(),
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateNotificationSettings({
    required bool notificationsEnabled,
    required bool soundEnabled,
    required bool vibrationEnabled,
  }) async {
    try {
      await _apiService.patch(
        '/api/v1/settings/notifications',
        data: {
          'notifications_enabled': notificationsEnabled,
          'sound_enabled': soundEnabled,
          'vibration_enabled': vibrationEnabled,
        },
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateTheme(String theme) async {
    try {
      await _apiService.patch(
        '/api/v1/settings/theme',
        data: {'theme': theme},
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateLanguage(String language) async {
    try {
      await _apiService.patch(
        '/api/v1/settings/language',
        data: {'language': language},
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateDailyGoal(int goal) async {
    try {
      await _apiService.patch(
        '/api/v1/settings/daily-goal',
        data: {'daily_goal': goal},
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateReminderSettings({
    required int hour,
    required int minute,
    required bool weekendReminder,
  }) async {
    try {
      await _apiService.patch(
        '/api/v1/settings/reminder',
        data: {
          'reminder_hour': hour,
          'reminder_minute': minute,
          'weekend_reminder': weekendReminder,
        },
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> resetSettings() async {
    try {
      await _apiService.post('/api/v1/settings/reset');
      return true;
    } catch (e) {
      return false;
    }
  }
}
