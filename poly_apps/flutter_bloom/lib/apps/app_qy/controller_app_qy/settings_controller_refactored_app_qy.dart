import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localization/flutter_localization.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/apps/app_qy/models_app_qy/settings_model_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/settings_service_app_qy.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class SettingsControllerRefactoredAppQy extends ChangeNotifier {
  final SettingsServiceAppQy _service;
  final FlutterLocalization _localization = FlutterLocalization.instance;
  SettingsController? _commonSettingsController;

  AppSettingsModelAppQy _settings;
  bool _isLoading = false;
  String? _error;

  SettingsControllerRefactoredAppQy({
    SettingsServiceAppQy? service,
    SettingsController? commonSettingsController,
  })  : _service = service ?? SettingsServiceAppQy(),
        _settings = AppSettingsModelAppQy.defaultSettings(),
        _commonSettingsController = commonSettingsController;

  AppSettingsModelAppQy get settings => _settings;
  bool get isLoading => _isLoading;
  String? get error => _error;

  LanguageVoiceSettings get languageVoice => _settings.languageVoice;
  LearningSettings get learning => _settings.learning;
  DisplaySettings get display => _settings.display;
  NotificationSettings get notification => _settings.notification;
  DataStorageSettings get dataStorage => _settings.dataStorage;

  Future<void> initialize() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _settings = await _service.loadSettings();
    } catch (e) {
      _error = e.toString();
      _settings = AppSettingsModelAppQy.defaultSettings();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateLanguageVoice(LanguageVoiceSettings newSettings) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _service.updateLanguageVoiceSettings(newSettings);
      if (success) {
        final previousLanguage = _settings.languageVoice.appLanguage;
        _settings.updateLanguageVoice(newSettings);

        // If language changed, update FlutterLocalization and notify
        if (newSettings.appLanguage != previousLanguage) {
          _localization.translate(newSettings.appLanguage);

          // Update AppLocale cache for immediate translation updates
          AppLocale.updateCurrentLanguage(newSettings.appLanguage);

          // Sync with common SettingsController for immediate UI refresh
          if (_commonSettingsController != null) {
            await _commonSettingsController!
                .changeLanguage(newSettings.appLanguage);
          }

          // Notify listeners to rebuild UI immediately
          notifyListeners();
        }
      } else {
        _error = 'Failed to update language/voice settings';
      }
      return success;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateLearning(LearningSettings newSettings) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _service.updateLearningSettings(newSettings);
      if (success) {
        _settings.updateLearning(newSettings);
      } else {
        _error = 'Failed to update learning settings';
      }
      return success;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateDisplay(DisplaySettings newSettings) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _service.updateDisplaySettings(newSettings);
      if (success) {
        _settings.updateDisplay(newSettings);

        // Sync with common SettingsController for immediate UI refresh
        if (_commonSettingsController != null) {
          // Handle theme mode: 'dark', 'light', or 'auto'
          if (newSettings.themeMode == 'dark') {
            await _commonSettingsController!
                .setSetting('theme_dark_mode', true);
          } else if (newSettings.themeMode == 'light') {
            await _commonSettingsController!
                .setSetting('theme_dark_mode', false);
          }
          // 'auto' mode is handled by MaterialApp's themeMode
        }
      } else {
        _error = 'Failed to update display settings';
      }
      return success;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateNotification(NotificationSettings newSettings) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _service.updateNotificationSettings(newSettings);
      if (success) {
        _settings.updateNotification(newSettings);
      } else {
        _error = 'Failed to update notification settings';
      }
      return success;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateDataStorage(DataStorageSettings newSettings) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _service.updateDataStorageSettings(newSettings);
      if (success) {
        _settings.updateDataStorage(newSettings);
      } else {
        _error = 'Failed to update data/storage settings';
      }
      return success;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateAppLanguage(String language) async {
    final newSettings = languageVoice.copyWith(appLanguage: language);
    final success = await updateLanguageVoice(newSettings);

    if (success) {
      _localization.translate(language);

      // Update AppLocale cache for immediate translation updates
      AppLocale.updateCurrentLanguage(language);

      // Sync with common SettingsController for immediate UI refresh
      if (_commonSettingsController != null) {
        await _commonSettingsController!.changeLanguage(language);
      }

      // Notify listeners to rebuild UI immediately
      // This ensures the settings page and all Consumer widgets rebuild
      notifyListeners();
    }

    return success;
  }

  Future<bool> updatePronunciationSpeed(double speed) async {
    final newSettings = languageVoice.copyWith(pronunciationSpeed: speed);
    return await updateLanguageVoice(newSettings);
  }

  Future<bool> updateAutoPlayOnStudy(bool value) async {
    final newSettings = languageVoice.copyWith(autoPlayOnStudy: value);
    return await updateLanguageVoice(newSettings);
  }

  Future<bool> updateDailyNewWords(int count) async {
    final newSettings = learning.copyWith(dailyNewWords: count);
    return await updateLearning(newSettings);
  }

  Future<bool> updateDailyReviewWords(int count) async {
    final newSettings = learning.copyWith(dailyReviewWords: count);
    return await updateLearning(newSettings);
  }

  Future<bool> updateDefaultLearningMode(String mode) async {
    final newSettings = learning.copyWith(defaultLearningMode: mode);
    return await updateLearning(newSettings);
  }

  Future<bool> updateThemeMode(String mode) async {
    final newSettings = display.copyWith(themeMode: mode);
    return await updateDisplay(newSettings);
  }

  Future<bool> updateThemeColor(String color) async {
    final newSettings = display.copyWith(themeColor: color);
    return await updateDisplay(newSettings);
  }

  Future<bool> updateFontSize(int size) async {
    final newSettings = display.copyWith(fontSize: size);
    return await updateDisplay(newSettings);
  }

  Future<bool> updateEnableAnimations(bool value) async {
    final newSettings = display.copyWith(enableAnimations: value);
    return await updateDisplay(newSettings);
  }

  Future<bool> updateHapticFeedback(bool value) async {
    final newSettings = display.copyWith(hapticFeedback: value);
    return await updateDisplay(newSettings);
  }

  Future<bool> updateDailyStudyReminder(bool value) async {
    final newSettings = notification.copyWith(dailyStudyReminder: value);
    return await updateNotification(newSettings);
  }

  Future<bool> updateReviewReminder(bool value) async {
    final newSettings = notification.copyWith(reviewReminder: value);
    return await updateNotification(newSettings);
  }

  Future<bool> updateAchievementNotification(bool value) async {
    final newSettings = notification.copyWith(achievementNotification: value);
    return await updateNotification(newSettings);
  }

  Future<bool> updateAutoSync(bool value) async {
    final newSettings = dataStorage.copyWith(autoSync: value);
    return await updateDataStorage(newSettings);
  }

  Future<bool> updateWifiOnlySync(bool value) async {
    final newSettings = dataStorage.copyWith(wifiOnlySync: value);
    return await updateDataStorage(newSettings);
  }

  Future<bool> resetToDefaults() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _service.resetToDefaults();
      if (success) {
        _settings = AppSettingsModelAppQy.defaultSettings();
      } else {
        _error = 'Failed to reset settings';
      }
      return success;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> exportSettings(String filePath) async {
    try {
      return await _service.exportSettings(filePath);
    } catch (e) {
      _error = e.toString();
      return false;
    }
  }

  Future<bool> importSettings(Map<String, dynamic> jsonData) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final success = await _service.importSettings(jsonData);
      if (success) {
        _settings = await _service.loadSettings();
      } else {
        _error = 'Failed to import settings';
      }
      return success;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
