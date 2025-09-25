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

import 'unified_storage.dart';

/// Base class for app-specific storage extensions
/// Each app should extend this class to define their own storage keys and methods
abstract class AppStorageBase {
  /// App-specific storage box name
  String get appBox;
  
  /// App-specific cache namespace
  String get cacheNamespace;
  
  /// Initialize app-specific storage
  Future<void> initAppStorage() async {
    await UnifiedStorage.init();
    // App-specific initialization can be overridden
  }
  
  
  /// Get value from common storage (synchronous for frequently accessed data)
  T? getCommonSync<T>(String key) {
    return UnifiedStorage.getSync<T>(key);
  }
  
  /// Set value in common storage (synchronous for frequently accessed data)
  void setCommonSync<T>(String key, T value) {
    UnifiedStorage.setSync<T>(key, value);
  }
  
  /// Get value from common storage (asynchronous)
  Future<T?> getCommon<T>(String key, {T? defaultValue}) async {
    return await UnifiedStorage.get<T>(key, defaultValue: defaultValue);
  }
  
  /// Set value in common storage (asynchronous)
  Future<void> setCommon<T>(String key, T value) async {
    await UnifiedStorage.set<T>(key, value);
  }
  
  
  /// Get value from app-specific storage
  Future<T?> getApp<T>(String key, {T? defaultValue}) async {
    return await UnifiedStorage.get<T>(key, box: appBox, defaultValue: defaultValue);
  }
  
  /// Set value in app-specific storage
  Future<void> setApp<T>(String key, T value) async {
    await UnifiedStorage.set<T>(key, value, box: appBox);
  }
  
  /// Remove value from app-specific storage
  Future<void> removeApp(String key) async {
    await UnifiedStorage.remove(key, box: appBox);
  }
  
  /// Clear app-specific storage
  Future<void> clearAppStorage() async {
    await UnifiedStorage.clearBox(appBox);
  }
  
  
  /// Get value from user storage
  Future<T?> getUser<T>(String key, {T? defaultValue}) async {
    return await UnifiedStorage.get<T>(key, box: UnifiedStorage.userBox, defaultValue: defaultValue);
  }
  
  /// Set value in user storage
  Future<void> setUser<T>(String key, T value) async {
    await UnifiedStorage.set<T>(key, value, box: UnifiedStorage.userBox);
  }
  
  /// Remove value from user storage
  Future<void> removeUser(String key) async {
    await UnifiedStorage.remove(key, box: UnifiedStorage.userBox);
  }
  
  /// Clear user storage
  Future<void> clearUserStorage() async {
    await UnifiedStorage.clearBox(UnifiedStorage.userBox);
  }
  
  
  /// Get value from memory cache with app namespace
  T? getCache<T>(String key) {
    return UnifiedStorage.getCache<T>('$cacheNamespace:$key');
  }
  
  /// Set value in memory cache with app namespace
  void setCache<T>(String key, T value, {Duration? expiry}) {
    UnifiedStorage.setCache<T>('$cacheNamespace:$key', value, expiry: expiry);
  }
  
  /// Remove value from memory cache with app namespace
  void removeCache(String key) {
    UnifiedStorage.removeCache('$cacheNamespace:$key');
  }
  
  /// Clear app-specific cache
  void clearAppCache() {
    // Remove all keys with app namespace
    final allKeys = UnifiedStorage.getCache<List<String>>('_all_keys') ?? [];
    final appKeys = allKeys.where((key) => key.startsWith('$cacheNamespace:')).toList();
    for (final key in appKeys) {
      UnifiedStorage.removeCache(key);
    }
  }
  

  /// Check if this is the first launch for this app
  bool isFirstLaunch() {
    return getCommonSync<bool>(CommonKeys.isFirstLaunch) ?? true;
  }

  /// Mark app as launched (not first launch anymore)
  void setNotFirstLaunch() {
    setCommonSync<bool>(CommonKeys.isFirstLaunch, false);
    // Increment launch count
    final currentCount = getLaunchCount();
    setLaunchCount(currentCount + 1);
    // Update last open time
    setLastOpenTime(DateTime.now());
  }

  /// Get app version
  String? getAppVersion() {
    return getCommonSync<String>(CommonKeys.appVersion);
  }

  /// Set app version
  void setAppVersion(String version) {
    setCommonSync<String>(CommonKeys.appVersion, version);
  }

  /// Get launch count
  int getLaunchCount() {
    return getCommonSync<int>(CommonKeys.launchCount) ?? 0;
  }

  /// Set launch count
  void setLaunchCount(int count) {
    setCommonSync<int>(CommonKeys.launchCount, count);
  }

  /// Get last open time
  DateTime? getLastOpenTime() {
    final timeStr = getCommonSync<String>(CommonKeys.lastOpenTime);
    return timeStr != null ? DateTime.tryParse(timeStr) : null;
  }

  /// Set last open time
  void setLastOpenTime(DateTime time) {
    setCommonSync<String>(CommonKeys.lastOpenTime, time.toIso8601String());
  }


  /// Get current locale
  String? getLocale() {
    return getCommonSync<String>(CommonKeys.locale);
  }

  /// Set locale
  void setLocale(String locale) {
    setCommonSync<String>(CommonKeys.locale, locale);
  }

  /// Get theme mode
  String? getThemeMode() {
    return getCommonSync<String>(CommonKeys.themeMode);
  }

  /// Set theme mode
  void setThemeMode(String themeMode) {
    setCommonSync<String>(CommonKeys.themeMode, themeMode);
  }

  /// Check if dark mode is enabled
  bool isDarkMode() {
    return getCommonSync<bool>(CommonKeys.isDarkMode) ?? false;
  }

  /// Set dark mode
  void setDarkMode(bool isDark) {
    setCommonSync<bool>(CommonKeys.isDarkMode, isDark);
    setCommonSync<String>(CommonKeys.themeMode, isDark ? 'dark' : 'light');
  }

  /// Toggle dark mode
  void toggleDarkMode() {
    setDarkMode(!isDarkMode());
  }

  /// Get font size
  double? getFontSize() {
    return getCommonSync<double>(CommonKeys.fontSize);
  }

  /// Set font size
  void setFontSize(double size) {
    setCommonSync<double>(CommonKeys.fontSize, size);
  }

  /// Get font family
  String? getFontFamily() {
    return getCommonSync<String>(CommonKeys.fontFamily);
  }

  /// Set font family
  void setFontFamily(String family) {
    setCommonSync<String>(CommonKeys.fontFamily, family);
  }


  /// Check if user is authenticated
  bool isAuthenticated() {
    return getCommonSync<bool>(CommonKeys.isAuthenticated) ?? false;
  }

  /// Get auth token
  String? getAuthToken() {
    return getCommonSync<String>(CommonKeys.authToken);
  }

  /// Set auth token
  void setAuthToken(String token) {
    setCommonSync<String>(CommonKeys.authToken, token);
    setCommonSync<bool>(CommonKeys.isAuthenticated, true);
    setLastLoginTime(DateTime.now());
  }

  /// Get user ID
  String? getUserId() {
    return getCommonSync<String>(CommonKeys.userId);
  }

  /// Set user ID
  void setUserId(String userId) {
    setCommonSync<String>(CommonKeys.userId, userId);
  }

  /// Get user email
  String? getUserEmail() {
    return getCommonSync<String>(CommonKeys.userEmail);
  }

  /// Set user email
  void setUserEmail(String email) {
    setCommonSync<String>(CommonKeys.userEmail, email);
  }

  /// Get username
  String? getUsername() {
    return getCommonSync<String>(CommonKeys.username);
  }

  /// Set username
  void setUsername(String username) {
    setCommonSync<String>(CommonKeys.username, username);
  }

  /// Get last login time
  DateTime? getLastLoginTime() {
    final timeStr = getCommonSync<String>(CommonKeys.lastLoginTime);
    return timeStr != null ? DateTime.tryParse(timeStr) : null;
  }

  /// Set last login time
  void setLastLoginTime(DateTime time) {
    setCommonSync<String>(CommonKeys.lastLoginTime, time.toIso8601String());
  }

  /// Clear authentication data
  Future<void> clearAuth() async {
    await setCommon<String?>(CommonKeys.authToken, null);
    await setCommon<String?>(CommonKeys.refreshToken, null);
    await setCommon<String?>(CommonKeys.userId, null);
    await setCommon<String?>(CommonKeys.userEmail, null);
    await setCommon<String?>(CommonKeys.username, null);
    await setCommon<bool>(CommonKeys.isAuthenticated, false);
    await setCommon<String?>(CommonKeys.lastLoginTime, null);
  }


  /// Check if notifications are enabled
  bool isNotificationsEnabled() {
    return getCommonSync<bool>(CommonKeys.notificationsEnabled) ?? true;
  }

  /// Set notifications enabled
  void setNotificationsEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.notificationsEnabled, enabled);
  }

  /// Check if push notifications are enabled
  bool isPushNotificationsEnabled() {
    return getCommonSync<bool>(CommonKeys.pushNotificationsEnabled) ?? true;
  }

  /// Set push notifications enabled
  void setPushNotificationsEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.pushNotificationsEnabled, enabled);
  }

  /// Check if sound is enabled
  bool isSoundEnabled() {
    return getCommonSync<bool>(CommonKeys.soundEnabled) ?? true;
  }

  /// Set sound enabled
  void setSoundEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.soundEnabled, enabled);
  }

  /// Check if vibration is enabled
  bool isVibrationEnabled() {
    return getCommonSync<bool>(CommonKeys.vibrationEnabled) ?? true;
  }

  /// Set vibration enabled
  void setVibrationEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.vibrationEnabled, enabled);
  }


  /// Check if auto sync is enabled
  bool isAutoSyncEnabled() {
    return getCommonSync<bool>(CommonKeys.autoSyncEnabled) ?? true;
  }

  /// Set auto sync enabled
  void setAutoSyncEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.autoSyncEnabled, enabled);
  }

  /// Check if offline mode is enabled
  bool isOfflineModeEnabled() {
    return getCommonSync<bool>(CommonKeys.offlineModeEnabled) ?? false;
  }

  /// Set offline mode enabled
  void setOfflineModeEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.offlineModeEnabled, enabled);
  }

  /// Check if analytics is enabled
  bool isAnalyticsEnabled() {
    return getCommonSync<bool>(CommonKeys.analyticsEnabled) ?? true;
  }

  /// Set analytics enabled
  void setAnalyticsEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.analyticsEnabled, enabled);
  }

  /// Check if crash reporting is enabled
  bool isCrashReportingEnabled() {
    return getCommonSync<bool>(CommonKeys.crashReportingEnabled) ?? true;
  }

  /// Set crash reporting enabled
  void setCrashReportingEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.crashReportingEnabled, enabled);
  }

  /// Check if data saver is enabled
  bool isDataSaverEnabled() {
    return getCommonSync<bool>(CommonKeys.dataSaverEnabled) ?? false;
  }

  /// Set data saver enabled
  void setDataSaverEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.dataSaverEnabled, enabled);
  }


  /// Check if animations are enabled
  bool isAnimationsEnabled() {
    return getCommonSync<bool>(CommonKeys.animationsEnabled) ?? true;
  }

  /// Set animations enabled
  void setAnimationsEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.animationsEnabled, enabled);
  }

  /// Check if haptic feedback is enabled
  bool isHapticFeedbackEnabled() {
    return getCommonSync<bool>(CommonKeys.hapticFeedbackEnabled) ?? true;
  }

  /// Set haptic feedback enabled
  void setHapticFeedbackEnabled(bool enabled) {
    setCommonSync<bool>(CommonKeys.hapticFeedbackEnabled, enabled);
  }

  /// Check if tutorials should be shown
  bool shouldShowTutorials() {
    return getCommonSync<bool>(CommonKeys.showTutorials) ?? true;
  }

  /// Set show tutorials
  void setShowTutorials(bool show) {
    setCommonSync<bool>(CommonKeys.showTutorials, show);
  }
  
  
  /// Get app-specific storage statistics
  Future<Map<String, dynamic>> getAppStats() async {
    final commonStats = await UnifiedStorage.getStats();
    
    return {
      'app_name': appBox,
      'cache_namespace': cacheNamespace,
      'common_stats': commonStats,
      'is_first_launch': isFirstLaunch(),
      'is_authenticated': isAuthenticated(),
      'locale': getLocale(),
      'theme_mode': getThemeMode(),
    };
  }
  
  /// Export app-specific data
  Future<Map<String, dynamic>> exportAppData() async {
    final allData = await UnifiedStorage.exportData();
    
    return {
      'app_name': appBox,
      'cache_namespace': cacheNamespace,
      'all_data': allData,
      'export_time': DateTime.now().toIso8601String(),
    };
  }
  
  /// Import app-specific data
  Future<void> importAppData(Map<String, dynamic> data) async {
    final allData = data['all_data'] as Map<String, dynamic>?;
    if (allData != null) {
      await UnifiedStorage.importData(allData);
    }
  }
  
  /// Refresh all cached data
  Future<void> refreshCache() async {
    await UnifiedStorage.refreshSyncCache();
  }


  /// Get user data
  Future<Map<String, dynamic>?> getUserData() async {
    return await getCommon<Map<String, dynamic>>(CommonKeys.userData);
  }

  /// Set user data
  Future<void> setUserData(Map<String, dynamic> userData) async {
    await setCommon<Map<String, dynamic>>(CommonKeys.userData, userData);
  }

  /// Clear user data
  Future<void> clearUserData() async {
    await setCommon<Map<String, dynamic>?>(CommonKeys.userData, null);
  }

  /// Get user preferences
  Future<Map<String, dynamic>> getUserPreferences() async {
    return await getCommon<Map<String, dynamic>>(CommonKeys.userPreferences) ?? {};
  }

  /// Set user preferences
  Future<void> setUserPreferences(Map<String, dynamic> preferences) async {
    await setCommon<Map<String, dynamic>>(CommonKeys.userPreferences, preferences);
  }

  /// Get bookmarks
  Future<List<String>> getBookmarks() async {
    return await getCommon<List<String>>(CommonKeys.bookmarks) ?? [];
  }

  /// Add bookmark
  Future<void> addBookmark(String bookmark) async {
    final bookmarks = await getBookmarks();
    if (!bookmarks.contains(bookmark)) {
      bookmarks.add(bookmark);
      await setCommon<List<String>>(CommonKeys.bookmarks, bookmarks);
    }
  }

  /// Remove bookmark
  Future<void> removeBookmark(String bookmark) async {
    final bookmarks = await getBookmarks();
    bookmarks.remove(bookmark);
    await setCommon<List<String>>(CommonKeys.bookmarks, bookmarks);
  }

  /// Get reading history
  Future<List<Map<String, dynamic>>> getReadingHistory() async {
    return await getCommon<List<Map<String, dynamic>>>(CommonKeys.readingHistory) ?? [];
  }

  /// Add to reading history
  Future<void> addToReadingHistory(Map<String, dynamic> item) async {
    final history = await getReadingHistory();
    // Remove if already exists to avoid duplicates
    history.removeWhere((h) => h['id'] == item['id']);
    // Add to beginning
    history.insert(0, item);
    // Keep only last 100 items
    if (history.length > 100) {
      history.removeRange(100, history.length);
    }
    await setCommon<List<Map<String, dynamic>>>(CommonKeys.readingHistory, history);
  }

  /// Clear reading history
  Future<void> clearReadingHistory() async {
    await setCommon<List<Map<String, dynamic>>>(CommonKeys.readingHistory, []);
  }

  /// Set remember credentials
  Future<void> setRememberCredentials(String email, String password) async {
    await setCommon<Map<String, String>>(CommonKeys.rememberCredentials, {
      'email': email,
      'password': password,
    });
  }

  /// Get remember credentials
  Future<Map<String, String>?> getRememberCredentials() async {
    return await getCommon<Map<String, String>>(CommonKeys.rememberCredentials);
  }

  /// Clear remember credentials
  Future<void> clearRememberCredentials() async {
    await setCommon<Map<String, String>?>(CommonKeys.rememberCredentials, null);
  }

  /// Clear auth token
  Future<void> clearAuthToken() async {
    await setCommon<String?>(CommonKeys.authToken, null);
    await setCommon<bool>(CommonKeys.isAuthenticated, false);
  }
}
