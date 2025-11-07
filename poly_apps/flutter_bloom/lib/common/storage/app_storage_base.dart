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

// @deprecated This file is marked as deprecated and should not be used in new code.
// Please use the newer storage implementation instead.

import 'package:qyflutter/common/storage/unified_storage.dart';

/// Base class for all app-specific storage implementations
///
/// This abstract class provides a common interface for all app-specific
/// storage classes that extend the unified storage system with app-specific
/// functionality and keys.
///
/// DESIGN:
/// - Provides a common interface for all apps
/// - Ensures type safety and consistency across different apps
/// - Allows the common system to work with any app's storage implementation
/// - Integrates with UnifiedStorage for persistent data
/// - Provides caching capabilities for frequently accessed data
///
/// IMPLEMENTATION REQUIREMENTS:
/// All app-specific storage classes MUST extend this class and implement:
/// - appBox getter to define the app-specific storage box name
/// - cacheNamespace getter to define the cache namespace
/// - initAppStorage() method for app-specific initialization
@Deprecated(
    'This class is deprecated. Please use the newer storage implementation instead.')
abstract class AppStorageBase {
  /// App-specific storage box name
  /// This should be unique for each app to avoid conflicts
  String get appBox;

  /// Cache namespace for this app
  /// Used to organize cached data by app
  String get cacheNamespace;

  /// Initialize app-specific storage
  /// Called after UnifiedStorage is initialized
  Future<void> initAppStorage();

  /// Get value from app-specific storage
  Future<T?> getApp<T>(String key, {T? defaultValue});

  /// Set value in app-specific storage
  Future<void> setApp<T>(String key, T value);

  /// Remove value from app-specific storage
  Future<void> removeApp(String key);

  /// Clear all app-specific storage
  Future<void> clearAppStorage();

  /// Clear user-specific storage
  Future<void> clearUserStorage();

  /// Clear app cache
  void clearAppCache();

  /// Get from memory cache
  T? getCache<T>(String key);

  /// Set in memory cache
  void setCache<T>(String key, T value, {Duration? expiry});

  /// Remove from memory cache
  void removeCache(String key);

  /// Clear all memory cache
  void clearCache();

  /// Refresh cache from storage
  Future<void> refreshCache();

  /// Export app data for backup
  Future<Map<String, dynamic>> exportAppData();

  /// Import app data from backup
  Future<void> importAppData(Map<String, dynamic> data);

  /// Clear authentication data
  Future<void> clearAuth();

  /// Check if this is the first launch
  bool isFirstLaunch();

  /// Set not first launch
  void setNotFirstLaunch();

  /// Check if user is authenticated
  bool isAuthenticated();

  /// Get current locale
  String? getLocale();

  /// Set locale
  void setLocale(String locale);

  /// Get theme mode
  String? getThemeMode();

  /// Set theme mode
  void setThemeMode(String themeMode);

  /// Check if dark mode is enabled
  bool isDarkMode();

  /// Toggle dark mode
  void toggleDarkMode();

  /// Set dark mode
  void setDarkMode(bool isDark);

  /// Get font family
  String? getFontFamily();

  /// Set font family
  void setFontFamily(String fontFamily);

  /// Get font size
  double? getFontSize();

  /// Set font size
  void setFontSize(double fontSize);

  /// Check if notifications are enabled
  bool isNotificationsEnabled();

  /// Set notifications enabled
  void setNotificationsEnabled(bool enabled);

  /// Check if sound is enabled
  bool isSoundEnabled();

  /// Set sound enabled
  void setSoundEnabled(bool enabled);

  /// Check if vibration is enabled
  bool isVibrationEnabled();

  /// Set vibration enabled
  void setVibrationEnabled(bool enabled);

  /// Check if animations are enabled
  bool isAnimationsEnabled();

  /// Set animations enabled
  void setAnimationsEnabled(bool enabled);

  /// Check if auto sync is enabled
  bool isAutoSyncEnabled();

  /// Set auto sync enabled
  void setAutoSyncEnabled(bool enabled);

  /// Get user data
  Future<Map<String, dynamic>?> getUserData();

  /// Set user data
  Future<void> setUserData(Map<String, dynamic> userData);

  /// Get user preferences
  Future<Map<String, dynamic>> getUserPreferences();

  /// Set user preferences
  Future<void> setUserPreferences(Map<String, dynamic> preferences);

  /// Get bookmarks
  Future<List<dynamic>> getBookmarks();

  /// Add bookmark
  Future<void> addBookmark(dynamic bookmark);

  /// Remove bookmark
  Future<void> removeBookmark(dynamic bookmark);

  /// Get reading history
  Future<List<dynamic>> getReadingHistory();

  /// Add to reading history
  Future<void> addToReadingHistory(dynamic item);

  /// Clear reading history
  Future<void> clearReadingHistory();
}

/// Default implementation of AppStorageBase
/// Provides common functionality that can be extended by app-specific implementations
@Deprecated(
    'This class is deprecated. Please use the newer storage implementation instead.')
abstract class AppStorageBaseImpl extends AppStorageBase {
  @override
  Future<T?> getApp<T>(String key, {T? defaultValue}) async {
    return await UnifiedStorage.getApp<T>(appBox, key,
        defaultValue: defaultValue);
  }

  @override
  Future<void> setApp<T>(String key, T value) async {
    await UnifiedStorage.setApp<T>(appBox, key, value);
  }

  @override
  Future<void> removeApp(String key) async {
    await UnifiedStorage.removeApp(appBox, key);
  }

  @override
  Future<void> clearAppStorage() async {
    await UnifiedStorage.clearAppStorage(appBox);
  }

  @override
  Future<void> clearUserStorage() async {
    await UnifiedStorage.clearBox('${appBox}_user');
  }

  @override
  void clearAppCache() {
    UnifiedStorage.clearCache();
  }

  @override
  T? getCache<T>(String key) {
    return UnifiedStorage.getCacheWithNamespace<T>(cacheNamespace, key);
  }

  @override
  void setCache<T>(String key, T value, {Duration? expiry}) {
    UnifiedStorage.setCacheWithNamespace<T>(cacheNamespace, key, value,
        expiry: expiry);
  }

  @override
  void removeCache(String key) {
    UnifiedStorage.removeCacheWithNamespace(cacheNamespace, key);
  }

  @override
  void clearCache() {
    UnifiedStorage.clearCache();
  }

  @override
  Future<void> refreshCache() async {
    await UnifiedStorage.refreshSyncCache();
  }

  @override
  Future<Map<String, dynamic>> exportAppData() async {
    final appData = await UnifiedStorage.get<Map<String, dynamic>>('app_data',
            box: appBox) ??
        {};
    final userData = await UnifiedStorage.get<Map<String, dynamic>>('user_data',
            box: '${appBox}_user') ??
        {};
    return {
      'app_data': appData,
      'user_data': userData,
      'cache_data': UnifiedStorage.exportData(),
    };
  }

  @override
  Future<void> importAppData(Map<String, dynamic> data) async {
    final appData = data['app_data'] as Map<String, dynamic>?;
    final userData = data['user_data'] as Map<String, dynamic>?;

    if (appData != null) {
      await UnifiedStorage.set('app_data', appData, box: appBox);
    }

    if (userData != null) {
      await UnifiedStorage.set('user_data', userData, box: '${appBox}_user');
    }
  }

  @override
  Future<void> clearAuth() async {
    await UnifiedStorage.remove('auth_token');
    await UnifiedStorage.remove('refresh_token');
    await UnifiedStorage.remove('user_id');
    await UnifiedStorage.remove('user_email');
    await UnifiedStorage.remove('is_authenticated');
    await UnifiedStorage.remove('user_data');
  }

  @override
  bool isFirstLaunch() {
    return UnifiedStorage.getSync<bool>('is_first_launch') ?? true;
  }

  @override
  void setNotFirstLaunch() {
    UnifiedStorage.setSync('is_first_launch', false);
  }

  @override
  bool isAuthenticated() {
    return UnifiedStorage.getSync<bool>('is_authenticated') ?? false;
  }

  @override
  String? getLocale() {
    return UnifiedStorage.getSync<String>('locale');
  }

  @override
  void setLocale(String locale) {
    UnifiedStorage.setSync('locale', locale);
  }

  @override
  String? getThemeMode() {
    return UnifiedStorage.getSync<String>('theme_mode');
  }

  @override
  void setThemeMode(String themeMode) {
    UnifiedStorage.setSync('theme_mode', themeMode);
  }

  @override
  bool isDarkMode() {
    return UnifiedStorage.getSync<bool>('is_dark_mode') ?? false;
  }

  @override
  void toggleDarkMode() {
    final currentMode = isDarkMode();
    setDarkMode(!currentMode);
  }

  @override
  void setDarkMode(bool isDark) {
    UnifiedStorage.setSync('is_dark_mode', isDark);
    UnifiedStorage.setSync('theme_mode', isDark ? 'dark' : 'light');
  }

  @override
  String? getFontFamily() {
    return UnifiedStorage.getSync<String>('font_family');
  }

  @override
  void setFontFamily(String fontFamily) {
    UnifiedStorage.setSync('font_family', fontFamily);
  }

  @override
  double? getFontSize() {
    return UnifiedStorage.getSync<double>('font_size');
  }

  @override
  void setFontSize(double fontSize) {
    UnifiedStorage.setSync('font_size', fontSize);
  }

  @override
  bool isNotificationsEnabled() {
    return UnifiedStorage.getSync<bool>('notifications_enabled') ?? true;
  }

  @override
  void setNotificationsEnabled(bool enabled) {
    UnifiedStorage.setSync('notifications_enabled', enabled);
  }

  @override
  bool isSoundEnabled() {
    return UnifiedStorage.getSync<bool>('sound_enabled') ?? true;
  }

  @override
  void setSoundEnabled(bool enabled) {
    UnifiedStorage.setSync('sound_enabled', enabled);
  }

  @override
  bool isVibrationEnabled() {
    return UnifiedStorage.getSync<bool>('vibration_enabled') ?? true;
  }

  @override
  void setVibrationEnabled(bool enabled) {
    UnifiedStorage.setSync('vibration_enabled', enabled);
  }

  @override
  bool isAnimationsEnabled() {
    return UnifiedStorage.getSync<bool>('animations_enabled') ?? true;
  }

  @override
  void setAnimationsEnabled(bool enabled) {
    UnifiedStorage.setSync('animations_enabled', enabled);
  }

  @override
  bool isAutoSyncEnabled() {
    return UnifiedStorage.getSync<bool>('auto_sync_enabled') ?? true;
  }

  @override
  void setAutoSyncEnabled(bool enabled) {
    UnifiedStorage.setSync('auto_sync_enabled', enabled);
  }

  @override
  Future<Map<String, dynamic>?> getUserData() async {
    return await UnifiedStorage.get<Map<String, dynamic>>('user_data',
        box: '${appBox}_user');
  }

  @override
  Future<void> setUserData(Map<String, dynamic> userData) async {
    await UnifiedStorage.set('user_data', userData, box: '${appBox}_user');
  }

  @override
  Future<Map<String, dynamic>> getUserPreferences() async {
    return await getApp<Map<String, dynamic>>('user_preferences') ?? {};
  }

  @override
  Future<void> setUserPreferences(Map<String, dynamic> preferences) async {
    await setApp('user_preferences', preferences);
  }

  @override
  Future<List<dynamic>> getBookmarks() async {
    return await getApp<List<dynamic>>('bookmarks') ?? [];
  }

  @override
  Future<void> addBookmark(dynamic bookmark) async {
    final bookmarks = await getBookmarks();
    bookmarks.add(bookmark);
    await setApp('bookmarks', bookmarks);
  }

  @override
  Future<void> removeBookmark(dynamic bookmark) async {
    final bookmarks = await getBookmarks();
    bookmarks.remove(bookmark);
    await setApp('bookmarks', bookmarks);
  }

  @override
  Future<List<dynamic>> getReadingHistory() async {
    return await getApp<List<dynamic>>('reading_history') ?? [];
  }

  @override
  Future<void> addToReadingHistory(dynamic item) async {
    final history = await getReadingHistory();
    history.insert(0, item);

    // Keep only last 100 items
    if (history.length > 100) {
      history.removeRange(100, history.length);
    }

    await setApp('reading_history', history);
  }

  @override
  Future<void> clearReadingHistory() async {
    await removeApp('reading_history');
  }
}
