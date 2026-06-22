import 'package:qyflutter/apps/app_qy/models_app_qy/settings_model_app_qy.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';

class SettingsServiceAppQy {
  static final SettingsServiceAppQy _instance = SettingsServiceAppQy._internal();
  factory SettingsServiceAppQy() => _instance;

  final StorageAppQy _storage;
  AppSettingsModelAppQy? _cachedSettings;

  static const String _settingsKey = 'app_settings';

  SettingsServiceAppQy._internal() : _storage = StorageAppQy.instance;

  Future<AppSettingsModelAppQy> loadSettings() async {
    if (_cachedSettings != null) {
      return _cachedSettings!;
    }

    try {
      final settingsJson = await _storage.getApp<Map<String, dynamic>>(_settingsKey);

      if (settingsJson != null) {
        _cachedSettings = AppSettingsModelAppQy.fromJson(settingsJson);
      } else {
        _cachedSettings = AppSettingsModelAppQy.defaultSettings();
        await saveSettings(_cachedSettings!);
      }

      return _cachedSettings!;
    } catch (e) {
      _cachedSettings = AppSettingsModelAppQy.defaultSettings();
      return _cachedSettings!;
    }
  }

  Future<bool> saveSettings(AppSettingsModelAppQy settings) async {
    try {
      await _storage.setApp<Map<String, dynamic>>(_settingsKey, settings.toJson());
      _cachedSettings = settings;
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateLanguageVoiceSettings(LanguageVoiceSettings settings) async {
    final currentSettings = await loadSettings();
    currentSettings.updateLanguageVoice(settings);
    return await saveSettings(currentSettings);
  }

  Future<bool> updateLearningSettings(LearningSettings settings) async {
    final currentSettings = await loadSettings();
    currentSettings.updateLearning(settings);
    return await saveSettings(currentSettings);
  }

  Future<bool> updateDisplaySettings(DisplaySettings settings) async {
    final currentSettings = await loadSettings();
    currentSettings.updateDisplay(settings);
    return await saveSettings(currentSettings);
  }

  Future<bool> updateNotificationSettings(NotificationSettings settings) async {
    final currentSettings = await loadSettings();
    currentSettings.updateNotification(settings);
    return await saveSettings(currentSettings);
  }

  Future<bool> updateDataStorageSettings(DataStorageSettings settings) async {
    final currentSettings = await loadSettings();
    currentSettings.updateDataStorage(settings);
    return await saveSettings(currentSettings);
  }

  Future<bool> resetToDefaults() async {
    _cachedSettings = AppSettingsModelAppQy.defaultSettings();
    return await saveSettings(_cachedSettings!);
  }

  Future<bool> clearCache() async {
    try {
      await _storage.removeApp(_settingsKey);
      _cachedSettings = null;
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> exportSettings(String filePath) async {
    try {
      final settings = await loadSettings();
      final jsonData = settings.toJson();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> importSettings(Map<String, dynamic> jsonData) async {
    try {
      final settings = AppSettingsModelAppQy.fromJson(jsonData);
      return await saveSettings(settings);
    } catch (e) {
      return false;
    }
  }

  AppSettingsModelAppQy? get cachedSettings => _cachedSettings;
}
