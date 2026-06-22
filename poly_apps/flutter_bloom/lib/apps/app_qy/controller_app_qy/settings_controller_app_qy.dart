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
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../config_app_qy/default_language_config_app_qy.dart';

// AI MODIFICATION NOTE: This controller was enhanced to follow development guide standards
// - Added integration with common SettingsController
// - Enhanced with proper app-specific settings management
// - Follows achat app structure and naming conventions
// Other AIs: Please maintain the integration with common settings controller

class SettingsControllerAppQy extends ChangeNotifier {
  final SettingsController _commonSettingsController;
  final StorageAppQy _storage = StorageAppQy.instance;
  final FlutterLocalization _localization = FlutterLocalization.instance;

  // Internal state for cached values
  bool _isInitialized = false;

  // Always true for LTR languages in this app
  bool get isLtr => true;
  bool get isInitialized => _isInitialized;

  SettingsControllerAppQy(this._commonSettingsController) {
    _initializeSettings();
  }

  /// Initialize all settings and load cached values
  Future<void> _initializeSettings() async {
    if (_isInitialized) return;

    await _storage.initAppStorage();
    await _loadCachedValues();
    _isInitialized = true;
    notifyListeners();
  }

  /// Load cached values from storage
  Future<void> _loadCachedValues() async {
    loadCurrentTheme();
    _loadLanguagePreference();
  }

  // Theme related properties and methods
  bool get isDarkMode => _storage.isDarkMode();

  ThemeMode get themeMode => isDarkMode ? ThemeMode.dark : ThemeMode.light;

  Future<void> toggleTheme() async {
    _storage.toggleDarkMode();
    // Also update common settings controller for immediate UI refresh
    await _commonSettingsController.setSetting('theme_dark_mode', isDarkMode);
    notifyListeners();
  }

  void loadCurrentTheme() {
    // Theme is now loaded automatically from unified storage
    notifyListeners();
  }

  void _loadLanguagePreference() {
    final storedLanguage = _storage.getLocale();
    if (storedLanguage != null) {
      _localization.translate(storedLanguage);
      // Also update common settings controller
      _commonSettingsController.setSetting('locale', storedLanguage);
    }
  }

  /// Get setting value from common settings controller
  T? getSetting<T>(String key, [T? defaultValue]) {
    return _commonSettingsController.getSetting<T>(key, defaultValue);
  }

  /// Set setting value in common settings controller
  Future<void> setSetting<T>(String key, T value) async {
    await _commonSettingsController.setSetting<T>(key, value);
    notifyListeners();
  }

  /// Check if setting exists
  bool hasSetting(String key) {
    return _commonSettingsController.hasSetting(key);
  }

  /// Get common settings controller instance
  SettingsController get commonSettingsController => _commonSettingsController;

  String getCurrentFontFamily() {
    return _storage.getFontFamily() ?? _localization.fontFamily ?? 'SFProText';
  }

  // Gets the current locale identifier
  String getCurrentLocaleIdentifier() {
    return _storage.getLocale() ??
        _localization.currentLocale?.languageCode ??
        DefaultLanguageConfigAppQy.defaultNativeLanguage;
  }

  // Change language and notify UI
  Future<void> changeLanguage(String languageCode) async {
    _storage.setLocale(languageCode);
    _localization.translate(languageCode);

    // Update AppLocale cache for immediate translation updates
    AppLocale.updateCurrentLanguage(languageCode);

    // Sync with common SettingsController for immediate UI refresh
    await _commonSettingsController.changeLanguage(languageCode);

    notifyListeners();
  }

  // Additional settings methods using unified storage

  /// Get font size
  double getFontSize() {
    return _storage.getFontSize() ?? 16.0;
  }

  /// Set font size
  void setFontSize(double size) {
    _storage.setFontSize(size);
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

  /// Check if animations are enabled
  bool isAnimationsEnabled() {
    return _storage.isAnimationsEnabled();
  }

  /// Set animations enabled
  void setAnimationsEnabled(bool enabled) {
    _storage.setAnimationsEnabled(enabled);
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

  /// Get all settings as a map
  Map<String, dynamic> getAllSettings() {
    return {
      'isDarkMode': isDarkMode,
      'locale': getCurrentLocaleIdentifier(),
      'fontFamily': getCurrentFontFamily(),
      'fontSize': getFontSize(),
      'notificationsEnabled': isNotificationsEnabled(),
      'soundEnabled': isSoundEnabled(),
      'vibrationEnabled': isVibrationEnabled(),
      'animationsEnabled': isAnimationsEnabled(),
      'autoSyncEnabled': isAutoSyncEnabled(),
    };
  }

  /// Reset all settings to defaults
  Future<void> resetToDefaults() async {
    _storage.setDarkMode(false);
    _storage.setLocale('en');
    _storage.setFontFamily('SFProText');
    _storage.setFontSize(16.0);
    _storage.setNotificationsEnabled(true);
    _storage.setSoundEnabled(true);
    _storage.setVibrationEnabled(true);
    _storage.setAnimationsEnabled(true);
    _storage.setAutoSyncEnabled(true);

    _localization.translate('en');
    notifyListeners();
  }
}
