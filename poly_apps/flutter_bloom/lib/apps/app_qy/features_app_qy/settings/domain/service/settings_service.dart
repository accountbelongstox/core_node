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
