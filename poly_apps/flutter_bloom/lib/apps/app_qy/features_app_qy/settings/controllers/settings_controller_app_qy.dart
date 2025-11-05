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
import '../domain/model/settings_model.dart';
import '../domain/service/settings_service.dart';

class SettingsControllerAppQy extends ChangeNotifier {
  final SettingsService _settingsService;
  AppSettingsModel _settings;
  bool _isLoading;
  String? _errorMessage;

  SettingsControllerAppQy({required SettingsService settingsService})
      : _settingsService = settingsService,
        _settings = AppSettingsModel.defaultSettings(),
        _isLoading = false;

  AppSettingsModel get settings => _settings;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> loadSettings() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _settings = await _settingsService.getSettings();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateSettings(AppSettingsModel newSettings) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final success = await _settingsService.updateSettings(newSettings);
      if (success) {
        _settings = newSettings;
      } else {
        _errorMessage = 'Failed to update settings';
      }
      return success;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> toggleNotifications(bool value) async {
    final success = await _settingsService.updateNotificationSettings(
      notificationsEnabled: value,
      soundEnabled: _settings.soundEnabled,
      vibrationEnabled: _settings.vibrationEnabled,
    );

    if (success) {
      _settings = _settings.copyWith(notificationsEnabled: value);
      notifyListeners();
    }
  }

  Future<void> toggleSound(bool value) async {
    final success = await _settingsService.updateNotificationSettings(
      notificationsEnabled: _settings.notificationsEnabled,
      soundEnabled: value,
      vibrationEnabled: _settings.vibrationEnabled,
    );

    if (success) {
      _settings = _settings.copyWith(soundEnabled: value);
      notifyListeners();
    }
  }

  Future<void> toggleVibration(bool value) async {
    final success = await _settingsService.updateNotificationSettings(
      notificationsEnabled: _settings.notificationsEnabled,
      soundEnabled: _settings.soundEnabled,
      vibrationEnabled: value,
    );

    if (success) {
      _settings = _settings.copyWith(vibrationEnabled: value);
      notifyListeners();
    }
  }

  Future<void> toggleAutoPlayAudio(bool value) async {
    _settings = _settings.copyWith(autoPlayAudio: value);
    await updateSettings(_settings);
  }

  Future<void> toggleShowTranslation(bool value) async {
    _settings = _settings.copyWith(showTranslation: value);
    await updateSettings(_settings);
  }

  Future<void> changeLanguage(String language) async {
    final success = await _settingsService.updateLanguage(language);
    if (success) {
      _settings = _settings.copyWith(language: language);
      notifyListeners();
    }
  }

  Future<void> changeTheme(String theme) async {
    final success = await _settingsService.updateTheme(theme);
    if (success) {
      _settings = _settings.copyWith(theme: theme);
      notifyListeners();
    }
  }

  Future<void> updateDailyGoal(int goal) async {
    final success = await _settingsService.updateDailyGoal(goal);
    if (success) {
      _settings = _settings.copyWith(dailyGoal: goal);
      notifyListeners();
    }
  }

  Future<void> updateReminderTime(int hour, int minute) async {
    final success = await _settingsService.updateReminderSettings(
      hour: hour,
      minute: minute,
      weekendReminder: _settings.weekendReminder,
    );

    if (success) {
      _settings = _settings.copyWith(
        reminderHour: hour,
        reminderMinute: minute,
      );
      notifyListeners();
    }
  }

  Future<void> toggleWeekendReminder(bool value) async {
    final success = await _settingsService.updateReminderSettings(
      hour: _settings.reminderHour,
      minute: _settings.reminderMinute,
      weekendReminder: value,
    );

    if (success) {
      _settings = _settings.copyWith(weekendReminder: value);
      notifyListeners();
    }
  }

  Future<bool> resetToDefaults() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final success = await _settingsService.resetSettings();
      if (success) {
        _settings = AppSettingsModel.defaultSettings();
      } else {
        _errorMessage = 'Failed to reset settings';
      }
      return success;
    } catch (e) {
      _errorMessage = e.toString();
      return false;
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
