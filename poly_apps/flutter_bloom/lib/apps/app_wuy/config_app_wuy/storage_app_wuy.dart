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

import 'app_config_app_wuy.dart';
import '../services_app_wuy/wuy_sqlite_storage_service.dart';

/// Storage management for Wuy App
/// Provides app-specific storage operations using SQLite storage system
class StorageAppWuy {
  static StorageAppWuy? _instance;
  static StorageAppWuy get instance => _instance ??= StorageAppWuy._internal();

  StorageAppWuy._internal();
  
  final WuySQLiteStorageService _sqliteStorage = WuySQLiteStorageService.instance;
  final Map<String, dynamic> _syncCache = {};

  /// Initialize app storage
  Future<void> initAppStorage() async {
    // SQLite storage is initialized by StorageConfigAppWuy
    // Load settings from SQLite to sync cache
    await _loadSettingsToCache();
  }
  
  /// Load settings from SQLite to sync cache
  Future<void> _loadSettingsToCache() async {
    try {
      final settings = [
        'wuy_dark_mode',
        'wuy_locale', 
        'wuy_font_family',
        'wuy_font_size',
        'wuy_animations_enabled',
        'wuy_notifications_enabled',
        'wuy_sound_enabled',
        'wuy_vibration_enabled',
        'wuy_auto_sync_enabled',
      ];
      
      for (final key in settings) {
        final value = await _sqliteStorage.getAppSetting(key);
        if (value != null) {
          _syncCache[key] = value;
        }
      }
    } catch (e) {
      // Ignore errors during cache loading
    }
  }
  
  /// Save setting to both cache and SQLite
  Future<void> _saveSetting(String key, dynamic value) async {
    _syncCache[key] = value;
    try {
      await _sqliteStorage.saveAppSetting(key, value);
    } catch (e) {
      // Ignore errors during save
    }
  }
  
  
  /// Get dark mode setting
  bool isDarkMode() {
    return _syncCache['wuy_dark_mode'] as bool? ?? false;
  }

  /// Set dark mode setting
  void setDarkMode(bool isDark) {
    _saveSetting('wuy_dark_mode', isDark);
  }

  /// Toggle dark mode
  void toggleDarkMode() {
    setDarkMode(!isDarkMode());
  }


  /// Get current locale
  String? getLocale() {
    return _syncCache['wuy_locale'] as String?;
  }

  /// Set current locale
  void setLocale(String locale) {
    _saveSetting('wuy_locale', locale);
  }

  /// Get font family
  String? getFontFamily() {
    return _syncCache['wuy_font_family'] as String?;
  }

  /// Set font family
  void setFontFamily(String fontFamily) {
    _saveSetting('wuy_font_family', fontFamily);
  }
  
  
  /// Get font size
  double? getFontSize() {
    return _syncCache['wuy_font_size'] as double?;
  }

  /// Set font size
  void setFontSize(double fontSize) {
    _saveSetting('wuy_font_size', fontSize);
  }

  /// Check if animations are enabled
  bool isAnimationsEnabled() {
    return _syncCache['wuy_animations_enabled'] as bool? ?? true;
  }

  /// Set animations enabled
  void setAnimationsEnabled(bool enabled) {
    _saveSetting('wuy_animations_enabled', enabled);
  }


  /// Check if notifications are enabled
  bool isNotificationsEnabled() {
    return _syncCache['wuy_notifications_enabled'] as bool? ?? true;
  }

  /// Set notifications enabled
  void setNotificationsEnabled(bool enabled) {
    _saveSetting('wuy_notifications_enabled', enabled);
  }
  
  /// Check if sound is enabled
  bool isSoundEnabled() {
    return _syncCache['wuy_sound_enabled'] as bool? ?? true;
  }

  /// Set sound enabled
  void setSoundEnabled(bool enabled) {
    _saveSetting('wuy_sound_enabled', enabled);
  }

  /// Check if vibration is enabled
  bool isVibrationEnabled() {
    return _syncCache['wuy_vibration_enabled'] as bool? ?? true;
  }

  /// Set vibration enabled
  void setVibrationEnabled(bool enabled) {
    _saveSetting('wuy_vibration_enabled', enabled);
  }


  /// Get user preferences
  Map<String, dynamic>? getUserPreferences() {
    return _syncCache[AppConfigAppWuy.storageKeyUserPrefs] as Map<String, dynamic>?;
  }

  /// Set user preferences
  void setUserPreferences(Map<String, dynamic> preferences) {
    _saveSetting(AppConfigAppWuy.storageKeyUserPrefs, preferences);
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
    return _syncCache[AppConfigAppWuy.storageKeyUserSession] as Map<String, dynamic>?;
  }

  /// Set user session data
  void setUserSession(Map<String, dynamic> session) {
    _saveSetting(AppConfigAppWuy.storageKeyUserSession, session);
  }

  /// Clear user session
  void clearUserSession() {
    _saveSetting(AppConfigAppWuy.storageKeyUserSession, null);
  }
  
  /// Check if user is logged in
  bool isUserLoggedIn() {
    final session = getUserSession();
    return session != null && session.containsKey('token');
  }
  
  
  /// Get cached data
  Map<String, dynamic>? getCacheData() {
    return _syncCache[AppConfigAppWuy.storageKeyCacheData] as Map<String, dynamic>?;
  }

  /// Set cached data
  void setCacheData(Map<String, dynamic> data) {
    _saveSetting(AppConfigAppWuy.storageKeyCacheData, data);
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
    _saveSetting(AppConfigAppWuy.storageKeyCacheData, null);
  }


  /// Check if auto sync is enabled
  bool isAutoSyncEnabled() {
    return _syncCache['wuy_auto_sync_enabled'] as bool? ?? true;
  }

  /// Set auto sync enabled
  void setAutoSyncEnabled(bool enabled) {
    _saveSetting('wuy_auto_sync_enabled', enabled);
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
    _syncCache.clear();
    // Note: SQLite storage clearing would need to be implemented in WuySQLiteStorageService
  }
  
  /// Get storage statistics
  Future<Map<String, dynamic>> getStorageStats() async {
    // Storage statistics implementation
    return {
      'totalKeys': 0,
      'totalSize': 0,
      'lastModified': DateTime.now().toIso8601String(),
    };
  }

  /// Get friends list from storage
  List<Map<String, dynamic>>? getFriendsList() {
    final cache = getCacheData();
    final friendsData = cache?[AppConfigAppWuy.storageKeyFriendsList];
    if (friendsData is List) {
      return friendsData.cast<Map<String, dynamic>>();
    }
    return null;
  }

  /// Save friends list to storage
  void setFriendsList(List<Map<String, dynamic>> friends) {
    setCachedItem(AppConfigAppWuy.storageKeyFriendsList, friends);
  }

  /// Get active friend from storage
  Map<String, dynamic>? getActiveFriend() {
    return getCachedItem<Map<String, dynamic>>(AppConfigAppWuy.storageKeyActiveFriend);
  }

  /// Set active friend to storage
  void setActiveFriend(Map<String, dynamic> friend) {
    setCachedItem(AppConfigAppWuy.storageKeyActiveFriend, friend);
  }

  /// Clear active friend from storage
  void clearActiveFriend() {
    setCachedItem(AppConfigAppWuy.storageKeyActiveFriend, null);
  }
}