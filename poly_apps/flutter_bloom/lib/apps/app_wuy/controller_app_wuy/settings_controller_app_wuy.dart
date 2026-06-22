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

import 'package:flutter/material.dart';
import 'package:flutter_localization/flutter_localization.dart';
import '../config_app_wuy/storage_app_wuy.dart';

/// Settings Controller for Wuy App
/// Manages app-specific settings and preferences
class SettingsControllerAppWuy extends ChangeNotifier {
  final StorageAppWuy _storage = StorageAppWuy.instance;
  final FlutterLocalization _localization = FlutterLocalization.instance;

  // Always true for LTR languages in this app
  bool get isLtr => true;

  SettingsControllerAppWuy() {
    _initializeStorage();
  }

  Future<void> _initializeStorage() async {
    await _storage.initAppStorage();
    loadCurrentTheme();
    _loadLanguagePreference();
  }


  /// Check if dark mode is enabled
  bool get isDarkMode => _storage.isDarkMode();

  /// Get current theme mode
  ThemeMode get themeMode => isDarkMode ? ThemeMode.dark : ThemeMode.light;

  /// Toggle theme between light and dark
  Future<void> toggleTheme() async {
    _storage.toggleDarkMode();
    notifyListeners();
  }

  /// Load current theme from storage
  void loadCurrentTheme() {
    notifyListeners();
  }


  /// Load language preference from storage
  void _loadLanguagePreference() {
    final storedLanguage = _storage.getLocale();
    if (storedLanguage != null) {
      _localization.translate(storedLanguage);
    }
  }

  /// Get current font family
  String getCurrentFontFamily() {
    return _storage.getFontFamily() ?? _localization.fontFamily ?? 'SFProText';
  }

  /// Get current locale identifier
  String getCurrentLocaleIdentifier() {
    return _storage.getLocale() ?? _localization.currentLocale?.languageCode ?? 'zh';
  }

  /// Change language and notify UI
  Future<void> changeLanguage(String languageCode) async {
    _storage.setLocale(languageCode);
    _localization.translate(languageCode);
    notifyListeners();
  }


  /// Get font size
  double getFontSize() {
    return _storage.getFontSize() ?? 16.0;
  }

  /// Set font size
  void setFontSize(double size) {
    _storage.setFontSize(size);
    notifyListeners();
  }

  /// Check if animations are enabled
  bool isAnimationsEnabled() {
    return _storage.isAnimationsEnabled();
  }

  /// Set animations enabled
  void setAnimationsEnabled(bool enabled) {
    _storage.setAnimationsEnabled(enabled);
    notifyListeners();
  }


  /// Check if notifications are enabled
  bool isNotificationsEnabled() {
    return _storage.isNotificationsEnabled();
  }

  /// Set notifications enabled
  void setNotificationsEnabled(bool enabled) {
    _storage.setNotificationsEnabled(enabled);
    notifyListeners();
  }

  /// Check if sound is enabled
  bool isSoundEnabled() {
    return _storage.isSoundEnabled();
  }

  /// Set sound enabled
  void setSoundEnabled(bool enabled) {
    _storage.setSoundEnabled(enabled);
    notifyListeners();
  }

  /// Check if vibration is enabled
  bool isVibrationEnabled() {
    return _storage.isVibrationEnabled();
  }

  /// Set vibration enabled
  void setVibrationEnabled(bool enabled) {
    _storage.setVibrationEnabled(enabled);
    notifyListeners();
  }


  /// Check if auto sync is enabled
  bool isAutoSyncEnabled() {
    return _storage.isAutoSyncEnabled();
  }

  /// Set auto sync enabled
  void setAutoSyncEnabled(bool enabled) {
    _storage.setAutoSyncEnabled(enabled);
    notifyListeners();
  }


  /// Get user preference
  T? getUserPreference<T>(String key) {
    return _storage.getUserPreference<T>(key);
  }

  /// Set user preference
  void setUserPreference<T>(String key, T value) {
    _storage.setUserPreference(key, value);
    notifyListeners();
  }

  /// Get all user preferences
  Map<String, dynamic>? getAllUserPreferences() {
    return _storage.getUserPreferences();
  }


  /// Check if welcome screen should be shown
  bool shouldShowWelcomeScreen() {
    return getUserPreference<bool>('wuy_show_welcome') ?? true;
  }

  /// Set welcome screen shown
  void setWelcomeScreenShown() {
    setUserPreference('wuy_show_welcome', false);
  }

  /// Get home screen layout preference
  String getHomeScreenLayout() {
    return getUserPreference<String>('wuy_home_layout') ?? 'grid';
  }

  /// Set home screen layout
  void setHomeScreenLayout(String layout) {
    setUserPreference('wuy_home_layout', layout);
  }

  /// Check if debug mode is enabled
  bool isDebugModeEnabled() {
    return getUserPreference<bool>('wuy_debug_mode') ?? false;
  }

  /// Set debug mode enabled
  void setDebugModeEnabled(bool enabled) {
    setUserPreference('wuy_debug_mode', enabled);
  }

  /// Get refresh interval in minutes
  int getRefreshInterval() {
    return getUserPreference<int>('wuy_refresh_interval') ?? 30;
  }

  /// Set refresh interval
  void setRefreshInterval(int minutes) {
    setUserPreference('wuy_refresh_interval', minutes);
  }

  /// Check if offline mode is enabled
  bool isOfflineModeEnabled() {
    return getUserPreference<bool>('wuy_offline_mode') ?? false;
  }

  /// Set offline mode enabled
  void setOfflineModeEnabled(bool enabled) {
    setUserPreference('wuy_offline_mode', enabled);
  }


  /// Get all settings as a map
  Map<String, dynamic> getAllSettings() {
    return {
      'isDarkMode': isDarkMode,
      'locale': getCurrentLocaleIdentifier(),
      'fontFamily': getCurrentFontFamily(),
      'fontSize': getFontSize(),
      'animationsEnabled': isAnimationsEnabled(),
      'notificationsEnabled': isNotificationsEnabled(),
      'soundEnabled': isSoundEnabled(),
      'vibrationEnabled': isVibrationEnabled(),
      'autoSyncEnabled': isAutoSyncEnabled(),
      'showWelcomeScreen': shouldShowWelcomeScreen(),
      'homeScreenLayout': getHomeScreenLayout(),
      'debugModeEnabled': isDebugModeEnabled(),
      'refreshInterval': getRefreshInterval(),
      'offlineModeEnabled': isOfflineModeEnabled(),
    };
  }

  /// Reset all settings to defaults
  Future<void> resetToDefaults() async {
    _storage.setDarkMode(false);
    _storage.setLocale('en');
    _storage.setFontFamily('SFProText');
    _storage.setFontSize(16.0);
    _storage.setAnimationsEnabled(true);
    _storage.setNotificationsEnabled(true);
    _storage.setSoundEnabled(true);
    _storage.setVibrationEnabled(true);
    _storage.setAutoSyncEnabled(true);

    // Reset Wuy specific settings
    setUserPreference('wuy_show_welcome', true);
    setUserPreference('wuy_home_layout', 'grid');
    setUserPreference('wuy_debug_mode', false);
    setUserPreference('wuy_refresh_interval', 30);
    setUserPreference('wuy_offline_mode', false);

    _localization.translate('en');
    notifyListeners();
  }

  /// Export settings to map
  Map<String, dynamic> exportSettings() {
    return {
      'version': '1.0.0',
      'timestamp': DateTime.now().toIso8601String(),
      'settings': getAllSettings(),
      'userPreferences': getAllUserPreferences(),
    };
  }

  /// Import settings from map
  Future<void> importSettings(Map<String, dynamic> data) async {
    try {
      final settings = data['settings'] as Map<String, dynamic>?;
      final userPrefs = data['userPreferences'] as Map<String, dynamic>?;

      if (settings != null) {
        // Import basic settings
        if (settings.containsKey('isDarkMode')) {
          _storage.setDarkMode(settings['isDarkMode'] as bool);
        }
        if (settings.containsKey('locale')) {
          _storage.setLocale(settings['locale'] as String);
        }
        if (settings.containsKey('fontSize')) {
          _storage.setFontSize(settings['fontSize'] as double);
        }
        // ... import other settings as needed
      }

      if (userPrefs != null) {
        _storage.setUserPreferences(userPrefs);
      }

      notifyListeners();
    } catch (e) {
      debugPrint('Error importing settings: $e');
    }
  }

  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    return await _storage.getStorageStats();
  }

  /// Clear all app data
  Future<void> clearAllData() async {
    await _storage.clearAllAppData();
    notifyListeners();
  }
}