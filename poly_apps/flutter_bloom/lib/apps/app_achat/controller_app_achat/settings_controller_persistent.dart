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

// CREATED BY: AI Assistant for AChat-specific Settings Controller
// NOTE FOR OTHER AIs: This is AChat-specific persistent settings controller
// Each app should have its own settings controller with app-specific keys

import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/config_app_achat/storage_app_achat.dart';
import 'package:qyflutter/apps/app_achat/config_app_achat/provider_app_achat.dart';
import 'package:qyflutter/apps/app_achat/config_app_achat/prefs_app_achat.dart';

/// AChat specific Settings Controller with persistence
/// Manages app settings with automatic persistence to storage
class SettingsControllerPersistent extends ChangeNotifier {
  final StorageAppAChat _storage = StorageAppAChat.instance;
  // Use the shared instance from provider_app_achat.dart
  PrefsAppAChat get _prefs => prefsAppAChat;

  // Settings state
  bool _isLoading = false;
  String? _errorMessage;
  Map<String, dynamic> _settings = {};

  // Getters
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic> get settings => Map.from(_settings);

  SettingsControllerPersistent() {
    _loadSettings();
  }

  /// Load settings from storage
  Future<void> _loadSettings() async {
    _isLoading = true;
    notifyListeners();

    try {
      // Load from storage
      final preferences = await _storage.getUserPreferences();
      _settings = Map.from(preferences);

      // Load from SharedPreferences for immediate access
      _loadFromPrefs();

      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Failed to load settings: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Load settings from SharedPreferences
  void _loadFromPrefs() {
    // AI Settings
    _settings[SettingKeys.aiPersonality] = _prefs.getString(SettingKeys.aiPersonality, 'friendly');
    _settings[SettingKeys.aiResponseStyle] = _prefs.getString(SettingKeys.aiResponseStyle, 'conversational');
    _settings[SettingKeys.aiTemperature] = _prefs.getDouble(SettingKeys.aiTemperature, 0.7);
    _settings[SettingKeys.aiMaxTokens] = _prefs.getInt(SettingKeys.aiMaxTokens, 1000);

    // Chat Settings
    _settings[SettingKeys.voiceInputEnabled] = _prefs.getBool(SettingKeys.voiceInputEnabled, true);
    _settings[SettingKeys.imageRecognitionEnabled] = _prefs.getBool(SettingKeys.imageRecognitionEnabled, true);
    _settings[SettingKeys.translationEnabled] = _prefs.getBool(SettingKeys.translationEnabled, false);
    _settings[SettingKeys.smartReplyEnabled] = _prefs.getBool(SettingKeys.smartReplyEnabled, true);
    _settings[SettingKeys.contextAwareEnabled] = _prefs.getBool(SettingKeys.contextAwareEnabled, true);
    _settings[SettingKeys.learningModeEnabled] = _prefs.getBool(SettingKeys.learningModeEnabled, false);

    // Notification Settings
    _settings[SettingKeys.notificationsEnabled] = _prefs.getBool(SettingKeys.notificationsEnabled, true);
    _settings[SettingKeys.notificationSoundEnabled] = _prefs.getBool(SettingKeys.notificationSoundEnabled, true);
    _settings[SettingKeys.messageSoundEnabled] = _prefs.getBool(SettingKeys.messageSoundEnabled, true);
    _settings[SettingKeys.vibrationEnabled] = _prefs.getBool(SettingKeys.vibrationEnabled, true);

    // Privacy Settings
    _settings[SettingKeys.readReceipts] = _prefs.getBool(SettingKeys.readReceipts, true);
    _settings[SettingKeys.lastSeenVisible] = _prefs.getBool(SettingKeys.lastSeenVisible, true);
    _settings[SettingKeys.profilePhotoVisible] = _prefs.getBool(SettingKeys.profilePhotoVisible, true);
    _settings[SettingKeys.analyticsEnabled] = _prefs.getBool(SettingKeys.analyticsEnabled, false);
    _settings[SettingKeys.crashReportingEnabled] = _prefs.getBool(SettingKeys.crashReportingEnabled, false);

    // Proxy Settings
    _settings[SettingKeys.proxyEnabled] = _prefs.getBool(SettingKeys.proxyEnabled, false);
    _settings[SettingKeys.proxyHost] = _prefs.getString(SettingKeys.proxyHost, '');
    _settings[SettingKeys.proxyPort] = _prefs.getInt(SettingKeys.proxyPort, 8080);
    _settings[SettingKeys.proxyType] = _prefs.getString(SettingKeys.proxyType, 'HTTP');

    // Theme Settings
    _settings[SettingKeys.themeMode] = _prefs.getString(SettingKeys.themeMode, 'system');
    _settings[SettingKeys.primaryColor] = _prefs.getString(SettingKeys.primaryColor, 'blue');
    _settings[SettingKeys.language] = _prefs.getString(SettingKeys.language, 'en');
  }

  /// Get setting value with type safety
  T? getSetting<T>(String key, [T? defaultValue]) {
    final value = _settings[key];
    if (value is T) {
      return value;
    }
    return defaultValue;
  }

  /// Set setting value with persistence
  Future<void> setSetting<T>(String key, T value) async {
    try {
      _settings[key] = value;

      // Save to SharedPreferences immediately
      await _prefs.set<T>(key, value);

      // Save to storage for backup
      await _storage.setUserPreferences(_settings);

      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to save setting $key: ${e.toString()}';
      notifyListeners();
    }
  }

  /// Batch update settings
  Future<void> batchUpdateSettings(Map<String, dynamic> updates) async {
    try {
      _settings.addAll(updates);

      // Save to SharedPreferences
      for (final entry in updates.entries) {
        await _prefs.set(entry.key, entry.value);
      }

      // Save to storage
      await _storage.setUserPreferences(_settings);

      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to batch update settings: ${e.toString()}';
      notifyListeners();
    }
  }

  /// Reset all settings to defaults
  Future<void> resetAllSettings() async {
    try {
      _settings.clear();
      await _prefs.clearAll();
      await _storage.setUserPreferences({});
      _loadFromPrefs(); // Reload with defaults
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to reset settings: ${e.toString()}';
      notifyListeners();
    }
  }

  /// Export settings
  Map<String, dynamic> exportSettings() {
    return Map.from(_settings);
  }

  /// Import settings
  Future<void> importSettings(Map<String, dynamic> settings) async {
    await batchUpdateSettings(settings);
  }

  /// Clear error message
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Refresh settings from storage
  Future<void> refresh() async {
    await _loadSettings();
  }

  // Convenience getters for common settings
  String get aiPersonality => getSetting<String>(SettingKeys.aiPersonality, 'friendly') ?? 'friendly';
  String get aiResponseStyle => getSetting<String>(SettingKeys.aiResponseStyle, 'conversational') ?? 'conversational';
  double get aiTemperature => getSetting<double>(SettingKeys.aiTemperature, 0.7) ?? 0.7;
  int get aiMaxTokens => getSetting<int>(SettingKeys.aiMaxTokens, 1000) ?? 1000;

  bool get voiceInputEnabled => getSetting<bool>(SettingKeys.voiceInputEnabled, true) ?? true;
  bool get imageRecognitionEnabled => getSetting<bool>(SettingKeys.imageRecognitionEnabled, true) ?? true;
  bool get translationEnabled => getSetting<bool>(SettingKeys.translationEnabled, false) ?? false;
  bool get smartReplyEnabled => getSetting<bool>(SettingKeys.smartReplyEnabled, true) ?? true;
  bool get contextAwareEnabled => getSetting<bool>(SettingKeys.contextAwareEnabled, true) ?? true;
  bool get learningModeEnabled => getSetting<bool>(SettingKeys.learningModeEnabled, false) ?? false;

  bool get notificationsEnabled => getSetting<bool>(SettingKeys.notificationsEnabled, true) ?? true;
  bool get notificationSoundEnabled => getSetting<bool>(SettingKeys.notificationSoundEnabled, true) ?? true;
  bool get messageSoundEnabled => getSetting<bool>(SettingKeys.messageSoundEnabled, true) ?? true;
  bool get vibrationEnabled => getSetting<bool>(SettingKeys.vibrationEnabled, true) ?? true;

  bool get readReceipts => getSetting<bool>(SettingKeys.readReceipts, true) ?? true;
  bool get lastSeenVisible => getSetting<bool>(SettingKeys.lastSeenVisible, true) ?? true;
  bool get profilePhotoVisible => getSetting<bool>(SettingKeys.profilePhotoVisible, true) ?? true;
  bool get analyticsEnabled => getSetting<bool>(SettingKeys.analyticsEnabled, false) ?? false;
  bool get crashReportingEnabled => getSetting<bool>(SettingKeys.crashReportingEnabled, false) ?? false;

  bool get proxyEnabled => getSetting<bool>(SettingKeys.proxyEnabled, false) ?? false;
  String get proxyHost => getSetting<String>(SettingKeys.proxyHost, '') ?? '';
  int get proxyPort => getSetting<int>(SettingKeys.proxyPort, 8080) ?? 8080;
  String get proxyType => getSetting<String>(SettingKeys.proxyType, 'HTTP') ?? 'HTTP';

  String get themeMode => getSetting<String>(SettingKeys.themeMode, 'system') ?? 'system';
  String get primaryColor => getSetting<String>(SettingKeys.primaryColor, 'blue') ?? 'blue';
  String get language => getSetting<String>(SettingKeys.language, 'en') ?? 'en';
}

/// AChat specific setting keys
class SettingKeys {
  // AI Settings
  static const String aiPersonality = 'ai_personality';
  static const String aiResponseStyle = 'ai_response_style';
  static const String aiTemperature = 'ai_temperature';
  static const String aiMaxTokens = 'ai_max_tokens';

  // Chat Settings
  static const String voiceInputEnabled = 'voice_input_enabled';
  static const String imageRecognitionEnabled = 'image_recognition_enabled';
  static const String translationEnabled = 'translation_enabled';
  static const String smartReplyEnabled = 'smart_reply_enabled';
  static const String contextAwareEnabled = 'context_aware_enabled';
  static const String learningModeEnabled = 'learning_mode_enabled';

  // Notification Settings
  static const String notificationsEnabled = 'notifications_enabled';
  static const String notificationSoundEnabled = 'notification_sound_enabled';
  static const String messageSoundEnabled = 'message_sound_enabled';
  static const String vibrationEnabled = 'vibration_enabled';

  // Privacy Settings
  static const String readReceipts = 'read_receipts';
  static const String lastSeenVisible = 'last_seen_visible';
  static const String profilePhotoVisible = 'profile_photo_visible';
  static const String analyticsEnabled = 'analytics_enabled';
  static const String crashReportingEnabled = 'crash_reporting_enabled';

  // Proxy Settings
  static const String proxyEnabled = 'proxy_enabled';
  static const String proxyHost = 'proxy_host';
  static const String proxyPort = 'proxy_port';
  static const String proxyType = 'proxy_type';

  // Theme Settings
  static const String themeMode = 'theme_mode';
  static const String primaryColor = 'primary_color';
  static const String language = 'language';
}
