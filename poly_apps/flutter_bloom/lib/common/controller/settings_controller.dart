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
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_localization/flutter_localization.dart';
import '../settings/models/setting_item.dart';
import '../settings/configs/base_settings.dart';
import '../settings/storage/settings_storage_manager.dart';

/// Common Settings Controller (comm_setting)
/// Manages base_sets + app_sets through hardcoded configuration
/// No if/else app judgments - uses hardcoded settings passed from entry points
class SettingsController extends ChangeNotifier {
  final SharedPreferences sharedPreferences;
  final FlutterLocalization _localization = FlutterLocalization.instance;
  final SettingsStorageManager _storageManager;

  // Settings configuration
  final List<SettingItem> _allSettings = [];
  final Map<String, SettingItem> _settingsMap = {};
  final Map<String, dynamic> _currentValues = {};

  // Initialization state
  bool _isInitialized = false;
  bool get isInitialized => _isInitialized;

  // Always true for LTR languages in this app
  bool get isLtr => true;

  SettingsController(
    this.sharedPreferences,
    this._storageManager, {
    List<SettingItem>? appSettings, // Hardcoded app settings passed from entry
  }) {
    _initializeSettings(appSettings ?? []);
  }

  /// Initialize the settings controller
  Future<void> initialize() async {
    if (_isInitialized) return;

    await _storageManager.initialize();
    await _loadAllSettings();
    _isInitialized = true;
  }

  /// Initialize settings by merging base_sets + app_sets
  void _initializeSettings(List<SettingItem> appSettings) {
    _allSettings.clear();
    _settingsMap.clear();

    // Add base settings (base_sets)
    final baseSettings = BaseSettings.getBaseSettings();
    _allSettings.addAll(baseSettings);

    // Add app-specific settings (app_sets)
    _allSettings.addAll(appSettings);

    // Build settings map for quick access
    for (final setting in _allSettings) {
      _settingsMap[setting.key] = setting;
    }
  }

  /// Load all settings from persistent storage
  Future<void> _loadAllSettings() async {
    final loadedValues = await _storageManager.loadAllSettings(_allSettings);
    _currentValues.clear();
    _currentValues.addAll(loadedValues);
  }



  /// Get setting value by key
  T? getSetting<T>(String key, [T? defaultValue]) {
    final setting = _settingsMap[key];
    if (setting == null) return defaultValue;

    return _currentValues[key] as T? ?? defaultValue ?? setting.defaultValue;
  }

  /// Set setting value by key
  Future<void> setSetting<T>(String key, T value) async {
    final setting = _settingsMap[key];
    if (setting == null) return;

    _currentValues[key] = value;
    await _storageManager.saveSetting(setting, value);
    notifyListeners();
  }

  /// Get all settings
  List<SettingItem> getAllSettings() => List.unmodifiable(_allSettings);

  /// Get settings by category
  Map<String, List<SettingItem>> getSettingsByCategory() {
    final Map<String, List<SettingItem>> grouped = {};

    for (final setting in _allSettings) {
      final category = setting.category ?? 'other';
      grouped.putIfAbsent(category, () => []);
      grouped[category]!.add(setting);
    }

    return grouped;
  }

  /// Get setting item by key
  SettingItem? getSettingItem(String key) => _settingsMap[key];

  /// Check if setting exists
  bool hasSetting(String key) => _settingsMap.containsKey(key);

  /// Reset setting to default value
  Future<void> resetSetting(String key) async {
    final setting = _settingsMap[key];
    if (setting != null) {
      await setSetting(key, setting.defaultValue);
    }
  }

  /// Reset all settings to default values
  Future<void> resetAllSettings() async {
    final Map<SettingItem, dynamic> defaultSettings = {};
    for (final setting in _allSettings) {
      _currentValues[setting.key] = setting.defaultValue;
      defaultSettings[setting] = setting.defaultValue;
    }
    await _storageManager.saveAllSettings(defaultSettings);
    notifyListeners();
  }

  /// Clear all settings from storage
  Future<void> clearAllSettings() async {
    await _storageManager.clearAllSettings();
    // Reset to default values
    for (final setting in _allSettings) {
      _currentValues[setting.key] = setting.defaultValue;
    }
    notifyListeners();
  }

  // Convenience methods for common settings

  /// Theme related methods
  bool get isDarkMode => getSetting<bool>('theme_dark_mode', false) ?? false;
  ThemeMode get themeMode => isDarkMode ? ThemeMode.dark : ThemeMode.light;

  Future<void> toggleTheme() async {
    await setSetting('theme_dark_mode', !isDarkMode);
  }

  /// Language related methods
  String getCurrentLocaleIdentifier() {
    return getSetting<String>('language', 'zh') ?? 'zh';
  }

  String getCurrentFontFamily() {
    final language = getCurrentLocaleIdentifier();
    if (language == 'zh') {
      return getSetting<String>('font_family', 'CN_font') ?? 'CN_font';
    }
    return getSetting<String>('font_family', 'SFProText') ?? 'SFProText';
  }

  Future<void> changeLanguage(String languageCode) async {
    await setSetting('language', languageCode);
    _localization.translate(languageCode);
  }

  /// Initialize settings for a specific app mode
  Future<void> initializeForApp(String appId) async {
    // App-specific initialization can be added here if needed
    // For now, just ensure settings are loaded
  }

  /// Initialize settings for show-all mode
  Future<void> initializeForShowAll() async {
    // Show-all mode initialization can be added here if needed
    // For now, just ensure settings are loaded
  }

  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    return await _storageManager.getStorageStats();
  }

  /// Check if a setting exists in storage
  Future<bool> hasSettingInStorage(String key) async {
    final setting = _settingsMap[key];
    if (setting == null) return false;
    return await _storageManager.hasSetting(setting);
  }

  /// Remove a setting from storage
  Future<void> removeSettingFromStorage(String key) async {
    final setting = _settingsMap[key];
    if (setting != null) {
      await _storageManager.removeSetting(setting);
      // Reset to default value
      _currentValues[key] = setting.defaultValue;
      notifyListeners();
    }
  }

  /// Get debug info about current settings
  Future<Map<String, dynamic>> getDebugInfo() async {
    final storageStats = await getStorageStats();
    return {
      'isDarkMode': isDarkMode,
      'currentLocale': getCurrentLocaleIdentifier(),
      'isInitialized': _isInitialized,
      'totalSettings': _allSettings.length,
      'currentValues': Map.from(_currentValues),
      'storageStats': storageStats,
      'settingsWithCacheDisabled': _allSettings
          .where((s) => s.disableCache)
          .map((s) => s.key)
          .toList(),
    };
  }
}
