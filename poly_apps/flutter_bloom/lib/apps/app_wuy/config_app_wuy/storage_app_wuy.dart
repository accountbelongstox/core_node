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

import '../../../common/storage/unified_storage.dart';
import 'constants_app_wuy.dart';

/// Storage management for Wuy App
/// Provides app-specific storage operations using the unified storage system
class StorageAppWuy {
  static StorageAppWuy? _instance;
  static StorageAppWuy get instance => _instance ??= StorageAppWuy._internal();

  StorageAppWuy._internal();

  /// Initialize app storage
  Future<void> initAppStorage() async {
    // UnifiedStorage is initialized by main_common.dart
    // No need to initialize here to avoid conflicts
  }
  
  
  /// Get dark mode setting
  bool isDarkMode() {
    return UnifiedStorage.getSync<bool>('wuy_dark_mode') ?? false;
  }

  /// Set dark mode setting
  void setDarkMode(bool isDark) {
    UnifiedStorage.setSync<bool>('wuy_dark_mode', isDark);
  }

  /// Toggle dark mode
  void toggleDarkMode() {
    setDarkMode(!isDarkMode());
  }


  /// Get current locale
  String? getLocale() {
    return UnifiedStorage.getSync<String>('wuy_locale');
  }

  /// Set current locale
  void setLocale(String locale) {
    UnifiedStorage.setSync<String>('wuy_locale', locale);
  }

  /// Get font family
  String? getFontFamily() {
    return UnifiedStorage.getSync<String>('wuy_font_family');
  }

  /// Set font family
  void setFontFamily(String fontFamily) {
    UnifiedStorage.setSync<String>('wuy_font_family', fontFamily);
  }
  
  
  /// Get font size
  double? getFontSize() {
    return UnifiedStorage.getSync<double>('wuy_font_size');
  }

  /// Set font size
  void setFontSize(double fontSize) {
    UnifiedStorage.setSync<double>('wuy_font_size', fontSize);
  }

  /// Check if animations are enabled
  bool isAnimationsEnabled() {
    return UnifiedStorage.getSync<bool>('wuy_animations_enabled') ?? true;
  }

  /// Set animations enabled
  void setAnimationsEnabled(bool enabled) {
    UnifiedStorage.setSync<bool>('wuy_animations_enabled', enabled);
  }


  /// Check if notifications are enabled
  bool isNotificationsEnabled() {
    return UnifiedStorage.getSync<bool>('wuy_notifications_enabled') ?? true;
  }

  /// Set notifications enabled
  void setNotificationsEnabled(bool enabled) {
    UnifiedStorage.setSync<bool>('wuy_notifications_enabled', enabled);
  }
  
  /// Check if sound is enabled
  bool isSoundEnabled() {
    return UnifiedStorage.getSync<bool>('wuy_sound_enabled') ?? true;
  }

  /// Set sound enabled
  void setSoundEnabled(bool enabled) {
    UnifiedStorage.setSync<bool>('wuy_sound_enabled', enabled);
  }

  /// Check if vibration is enabled
  bool isVibrationEnabled() {
    return UnifiedStorage.getSync<bool>('wuy_vibration_enabled') ?? true;
  }

  /// Set vibration enabled
  void setVibrationEnabled(bool enabled) {
    UnifiedStorage.setSync<bool>('wuy_vibration_enabled', enabled);
  }


  /// Get user preferences
  Map<String, dynamic>? getUserPreferences() {
    return UnifiedStorage.getSync<Map<String, dynamic>>(ConstantsAppWuy.storageKeyUserPrefs);
  }

  /// Set user preferences
  void setUserPreferences(Map<String, dynamic> preferences) {
    UnifiedStorage.setSync<Map<String, dynamic>>(ConstantsAppWuy.storageKeyUserPrefs, preferences);
  }
  
  /// Get specific user preference
  T? getUserPreference<T>(String key) {
    final prefs = getUserPreferences();
    return prefs?[key] as T?;
  }
  
  /// Set specific user preference
  void setUserPreference<T>(String key, T value) {
    final prefs = getUserPreferences() ?? <String, dynamic>{};
    prefs[key] = value;
    setUserPreferences(prefs);
  }
  
  
  /// Get user session data
  Map<String, dynamic>? getUserSession() {
    return UnifiedStorage.getSync<Map<String, dynamic>>(ConstantsAppWuy.storageKeyUserSession);
  }

  /// Set user session data
  void setUserSession(Map<String, dynamic> session) {
    UnifiedStorage.setSync<Map<String, dynamic>>(ConstantsAppWuy.storageKeyUserSession, session);
  }

  /// Clear user session
  void clearUserSession() {
    UnifiedStorage.setSync<Map<String, dynamic>?>(ConstantsAppWuy.storageKeyUserSession, null);
  }
  
  /// Check if user is logged in
  bool isUserLoggedIn() {
    final session = getUserSession();
    return session != null && session.containsKey('token');
  }
  
  
  /// Get cached data
  Map<String, dynamic>? getCacheData() {
    return UnifiedStorage.getSync<Map<String, dynamic>>(ConstantsAppWuy.storageKeyCacheData);
  }

  /// Set cached data
  void setCacheData(Map<String, dynamic> data) {
    UnifiedStorage.setSync<Map<String, dynamic>>(ConstantsAppWuy.storageKeyCacheData, data);
  }
  
  /// Get specific cached item
  T? getCachedItem<T>(String key) {
    final cache = getCacheData();
    return cache?[key] as T?;
  }
  
  /// Set specific cached item
  void setCachedItem<T>(String key, T value) {
    final cache = getCacheData() ?? <String, dynamic>{};
    cache[key] = value;
    setCacheData(cache);
  }
  
  /// Clear cache data
  void clearCache() {
    UnifiedStorage.setSync<Map<String, dynamic>?>(ConstantsAppWuy.storageKeyCacheData, null);
  }


  /// Check if auto sync is enabled
  bool isAutoSyncEnabled() {
    return UnifiedStorage.getSync<bool>('wuy_auto_sync_enabled') ?? true;
  }

  /// Set auto sync enabled
  void setAutoSyncEnabled(bool enabled) {
    UnifiedStorage.setSync<bool>('wuy_auto_sync_enabled', enabled);
  }
  
  /// Get app settings
  Map<String, dynamic> getAppSettings() {
    return {
      'isDarkMode': isDarkMode(),
      'locale': getLocale(),
      'fontFamily': getFontFamily(),
      'fontSize': getFontSize(),
      'animationsEnabled': isAnimationsEnabled(),
      'notificationsEnabled': isNotificationsEnabled(),
      'soundEnabled': isSoundEnabled(),
      'vibrationEnabled': isVibrationEnabled(),
      'autoSyncEnabled': isAutoSyncEnabled(),
    };
  }
  
  /// Clear all app data
  Future<void> clearAllAppData() async {
    await UnifiedStorage.clearBox(UnifiedStorage.commonBox);
    await UnifiedStorage.clearBox(UnifiedStorage.userBox);
    await UnifiedStorage.clearBox(UnifiedStorage.cacheBox);
  }
  
  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    // TODO: Implement storage statistics
    return {
      'totalKeys': 0,
      'totalSize': 0,
      'lastModified': DateTime.now().toIso8601String(),
    };
  }
}