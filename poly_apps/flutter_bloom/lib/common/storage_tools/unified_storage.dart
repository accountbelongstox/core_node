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

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'storage_manager.dart';
import '../utils/database/cache_operations.dart';

/// Unified storage system that combines persistent storage and memory cache
/// Provides both common storage keys and app-specific extensions
abstract class UnifiedStorage {
  static final Map<String, dynamic> _syncCache = {};
  static bool _initialized = false;
  
  // Storage boxes
  static const String commonBox = 'common_storage';
  static const String userBox = 'user_storage';
  static const String cacheBox = 'cache_storage';
  
  /// Initialize the unified storage system
  static Future<void> init({String? appName}) async {
    if (_initialized) return;
    
    await StorageManager.instance.init(appName: appName);
    await StorageManager.instance.openBox(commonBox);
    await StorageManager.instance.openBox(userBox);
    await StorageManager.instance.openBox(cacheBox);
    
    // Load frequently accessed data into sync cache
    await _loadSyncCache();
    
    _initialized = true;
  }
  
  /// Load frequently accessed data into synchronous cache
  static Future<void> _loadSyncCache() async {
    // Load app lifecycle data
    final isFirstLaunch = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.isFirstLaunch, defaultValue: true);
    final appVersion = await StorageManager.instance
        .getValue<String>(commonBox, CommonKeys.appVersion);
    final launchCount = await StorageManager.instance
        .getValue<int>(commonBox, CommonKeys.launchCount, defaultValue: 0);

    // Load user preferences
    final locale = await StorageManager.instance
        .getValue<String>(commonBox, CommonKeys.locale);
    final themeMode = await StorageManager.instance
        .getValue<String>(commonBox, CommonKeys.themeMode);
    final isDarkMode = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.isDarkMode, defaultValue: false);
    final fontSize = await StorageManager.instance
        .getValue<double>(commonBox, CommonKeys.fontSize);

    // Load authentication data
    final authToken = await StorageManager.instance
        .getValue<String>(commonBox, CommonKeys.authToken);
    final userId = await StorageManager.instance
        .getValue<String>(commonBox, CommonKeys.userId);
    final userEmail = await StorageManager.instance
        .getValue<String>(commonBox, CommonKeys.userEmail);
    final isAuthenticated = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.isAuthenticated, defaultValue: false);

    // Load notification settings
    final notificationsEnabled = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.notificationsEnabled, defaultValue: true);
    final soundEnabled = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.soundEnabled, defaultValue: true);
    final vibrationEnabled = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.vibrationEnabled, defaultValue: true);

    // Load app settings
    final autoSyncEnabled = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.autoSyncEnabled, defaultValue: true);
    final offlineModeEnabled = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.offlineModeEnabled, defaultValue: false);
    final analyticsEnabled = await StorageManager.instance
        .getValue<bool>(commonBox, CommonKeys.analyticsEnabled, defaultValue: true);

    // Store in sync cache
    _syncCache[CommonKeys.isFirstLaunch] = isFirstLaunch ?? true;
    _syncCache[CommonKeys.appVersion] = appVersion;
    _syncCache[CommonKeys.launchCount] = launchCount ?? 0;
    _syncCache[CommonKeys.locale] = locale;
    _syncCache[CommonKeys.themeMode] = themeMode;
    _syncCache[CommonKeys.isDarkMode] = isDarkMode ?? false;
    _syncCache[CommonKeys.fontSize] = fontSize;
    _syncCache[CommonKeys.authToken] = authToken;
    _syncCache[CommonKeys.userId] = userId;
    _syncCache[CommonKeys.userEmail] = userEmail;
    _syncCache[CommonKeys.isAuthenticated] = isAuthenticated ?? false;
    _syncCache[CommonKeys.notificationsEnabled] = notificationsEnabled ?? true;
    _syncCache[CommonKeys.soundEnabled] = soundEnabled ?? true;
    _syncCache[CommonKeys.vibrationEnabled] = vibrationEnabled ?? true;
    _syncCache[CommonKeys.autoSyncEnabled] = autoSyncEnabled ?? true;
    _syncCache[CommonKeys.offlineModeEnabled] = offlineModeEnabled ?? false;
    _syncCache[CommonKeys.analyticsEnabled] = analyticsEnabled ?? true;
  }
  
  /// Refresh sync cache from persistent storage
  static Future<void> refreshSyncCache() async {
    await _loadSyncCache();
  }
  
  
  /// Get value synchronously from cache (for frequently accessed data)
  static T? getSync<T>(String key) {
    _ensureInitialized();
    return _syncCache[key] as T?;
  }
  
  /// Set value synchronously and persist asynchronously
  static void setSync<T>(String key, T value) {
    _ensureInitialized();
    _syncCache[key] = value;
    
    // Persist asynchronously
    _persistSyncValue(key, value);
  }
  
  /// Persist sync cache value to storage with serialization
  static Future<void> _persistSyncValue<T>(String key, T value) async {
    final serializedValue = _serializeValue<T>(value);
    await StorageManager.instance.putValue<dynamic>(commonBox, key, serializedValue);
  }
  
  
  /// Get value from persistent storage with automatic deserialization
  static Future<T?> get<T>(String key, {String? box, T? defaultValue}) async {
    _ensureInitialized();
    final targetBox = box ?? commonBox;
    final value = await StorageManager.instance.getValue<dynamic>(targetBox, key, defaultValue: defaultValue);
    return _deserializeValue<T>(value) ?? defaultValue;
  }
  
  /// Set value in persistent storage with automatic serialization
  static Future<void> set<T>(String key, T value, {String? box}) async {
    _ensureInitialized();
    final targetBox = box ?? commonBox;
    
    // Serialize complex objects to JSON string to avoid HiveError
    final serializedValue = _serializeValue<T>(value);
    await StorageManager.instance.putValue<dynamic>(targetBox, key, serializedValue);
    
    // Update sync cache if it's a common key
    if (targetBox == commonBox && _syncCache.containsKey(key)) {
      _syncCache[key] = value;
    }
  }
  
  /// Remove value from storage
  static Future<void> remove(String key, {String? box}) async {
    _ensureInitialized();
    final targetBox = box ?? commonBox;
    await StorageManager.instance.deleteKey(targetBox, key);
    
    // Remove from sync cache if exists
    if (targetBox == commonBox) {
      _syncCache.remove(key);
    }
  }
  
  /// Clear entire box
  static Future<void> clearBox(String box) async {
    _ensureInitialized();
    await StorageManager.instance.clearBox(box);
    
    // Clear sync cache if common box
    if (box == commonBox) {
      _syncCache.clear();
      await _loadSyncCache();
    }
  }
  
  
  /// Get from memory cache (temporary data)
  static T? getCache<T>(String key) {
    return CacheOperations.get<T>(key);
  }
  
  /// Set in memory cache (temporary data)
  static void setCache<T>(String key, T value, {Duration? expiry}) {
    CacheOperations.set<T>(key, value, expiry: expiry);
  }
  
  /// Remove from memory cache
  static void removeCache(String key) {
    CacheOperations.remove(key);
  }
  
  /// Clear all memory cache
  static void clearCache() {
    CacheOperations.clear();
  }
  
  /// App-specific storage methods
  /// Get value from app-specific storage
  static Future<T?> getApp<T>(String appBox, String key, {T? defaultValue}) async {
    return await get<T>(key, box: appBox, defaultValue: defaultValue);
  }
  
  /// Set value in app-specific storage
  static Future<void> setApp<T>(String appBox, String key, T value) async {
    await set<T>(key, value, box: appBox);
  }
  
  /// Remove value from app-specific storage
  static Future<void> removeApp(String appBox, String key) async {
    await remove(key, box: appBox);
  }
  
  /// Clear app-specific storage
  static Future<void> clearAppStorage(String appBox) async {
    await clearBox(appBox);
  }
  
  /// Get value from memory cache with namespace
  static T? getCacheWithNamespace<T>(String namespace, String key) {
    return getCache<T>('$namespace:$key');
  }
  
  /// Set value in memory cache with namespace
  static void setCacheWithNamespace<T>(String namespace, String key, T value, {Duration? expiry}) {
    setCache<T>('$namespace:$key', value, expiry: expiry);
  }
  
  /// Remove value from memory cache with namespace
  static void removeCacheWithNamespace(String namespace, String key) {
    removeCache('$namespace:$key');
  }
  
  
  /// Check if storage is initialized
  static bool get isInitialized => _initialized;
  
  /// Ensure storage is initialized
  static void _ensureInitialized() {
    if (!_initialized) {
      throw StateError('UnifiedStorage not initialized. Call UnifiedStorage.init() first.');
    }
  }
  
  /// Serialize value for storage to avoid HiveError
  static dynamic _serializeValue<T>(T value) {
    if (value == null) return null;
    
    // Primitive types can be stored directly
    if (value is String || value is int || value is double || value is bool) {
      return value;
    }
    
    // Lists and Maps of primitive types
    if (value is List<String> || value is List<int> || value is List<double> || value is List<bool>) {
      return value;
    }
    
    if (value is Map<String, dynamic> || value is Map<String, String> || 
        value is Map<String, int> || value is Map<String, double> || value is Map<String, bool>) {
      return value;
    }
    
    // Complex objects - serialize to JSON string
    try {
      // Check if object has toMap method
      if (value.runtimeType.toString().contains('Model') || 
          value.runtimeType.toString().contains('Data')) {
        try {
          final map = (value as dynamic).toMap();
          return jsonEncode(map);
        } catch (e) {
          if (kDebugMode) {
            print('UnifiedStorage: Failed to serialize $T to JSON: $e');
          }
          return jsonEncode({'error': 'serialization_failed', 'type': T.toString()});
        }
      }
      
      // Fallback to JSON encoding
      return jsonEncode(value);
    } catch (e) {
      if (kDebugMode) {
        print('UnifiedStorage: JSON serialization failed for $T: $e');
      }
      return jsonEncode({'error': 'serialization_failed', 'type': T.toString()});
    }
  }
  
  /// Deserialize value from storage
  static T? _deserializeValue<T>(dynamic value) {
    if (value == null) return null;
    
    // If it's already the correct type, return as is
    if (value is T) return value;
    
    // If it's a JSON string, try to deserialize
    if (value is String) {
      try {
        final dynamic decoded = jsonDecode(value);

        // Handle serialization error wrapper
        if (decoded is Map<String, dynamic> &&
            decoded.containsKey('error') &&
            decoded['error'] == 'serialization_failed') {
          if (kDebugMode) {
            print('UnifiedStorage: Deserialization failed for $T (serialization_failed marker)');
          }
          return null;
        }

        // If decoded value already matches the expected type, return directly
        if (decoded is T) {
          return decoded;
        }

        // Fallback: try a safe cast, swallow type errors
        try {
          return decoded as T?;
        } catch (e) {
          if (kDebugMode) {
            print('UnifiedStorage: Type cast failed for $T after JSON decode: $e');
          }
          return null;
        }
      } catch (e) {
        if (kDebugMode) {
          print('UnifiedStorage: JSON deserialization failed for $T: $e');
        }
        return null;
      }
    }
    
    return value as T?;
  }
  
  /// Get storage statistics
  static Future<Map<String, dynamic>> getStats() async {
    _ensureInitialized();
    
    return {
      'initialized': _initialized,
      'sync_cache_size': _syncCache.length,
      'sync_cache_keys': _syncCache.keys.toList(),
      'memory_cache_stats': CacheOperations.getStats(),
      'boxes': [commonBox, userBox, cacheBox],
    };
  }
  
  /// Export all data for backup
  static Future<Map<String, dynamic>> exportData() async {
    _ensureInitialized();
    
    final commonData = await StorageManager.instance.getAllFromBox(commonBox);
    final userData = await StorageManager.instance.getAllFromBox(userBox);
    final cacheData = await StorageManager.instance.getAllFromBox(cacheBox);
    
    return {
      'common': commonData,
      'user': userData,
      'cache': cacheData,
      'memory_cache': CacheOperations.exportToJson(),
      'sync_cache': Map.from(_syncCache),
      'timestamp': DateTime.now().toIso8601String(),
    };
  }
  
  /// Import data from backup
  static Future<void> importData(Map<String, dynamic> data) async {
    _ensureInitialized();
    
    // Clear existing data
    await clearBox(commonBox);
    await clearBox(userBox);
    await clearBox(cacheBox);
    clearCache();
    
    // Import data
    final commonData = data['common'] as Map<String, dynamic>?;
    final userData = data['user'] as Map<String, dynamic>?;
    final cacheData = data['cache'] as Map<String, dynamic>?;
    final memoryCacheData = data['memory_cache'] as Map<String, dynamic>?;
    final syncCacheData = data['sync_cache'] as Map<String, dynamic>?;
    
    if (commonData != null) {
      for (final entry in commonData.entries) {
        await set(entry.key, entry.value, box: commonBox);
      }
    }
    
    if (userData != null) {
      for (final entry in userData.entries) {
        await set(entry.key, entry.value, box: userBox);
      }
    }
    
    if (cacheData != null) {
      for (final entry in cacheData.entries) {
        await set(entry.key, entry.value, box: cacheBox);
      }
    }
    
    if (memoryCacheData != null) {
      CacheOperations.importFromJson(memoryCacheData);
    }
    
    if (syncCacheData != null) {
      _syncCache.clear();
      _syncCache.addAll(syncCacheData);
    }
  }
}

/// Common storage keys used across all apps
class CommonKeys {
  static const String isFirstLaunch = 'is_first_launch';
  static const String appVersion = 'app_version';
  static const String lastOpenTime = 'last_open_time';
  static const String installTime = 'install_time';
  static const String launchCount = 'launch_count';
  static const String lastUpdateTime = 'last_update_time';

  static const String locale = 'locale';
  static const String themeMode = 'theme_mode';
  static const String isDarkMode = 'is_dark_mode';
  static const String fontSize = 'font_size';
  static const String fontFamily = 'font_family';
  static const String textDirection = 'text_direction';

  static const String authToken = 'auth_token';
  static const String refreshToken = 'refresh_token';
  static const String tokenType = 'token_type';
  static const String tokenExpiry = 'token_expiry';
  static const String userId = 'user_id';
  static const String userEmail = 'user_email';
  static const String username = 'username';
  static const String userRole = 'user_role';
  static const String isAuthenticated = 'is_authenticated';
  static const String lastLoginTime = 'last_login_time';
  static const String rememberMe = 'remember_me';
  static const String userData = 'user_data';
  static const String userPreferences = 'user_preferences';
  static const String bookmarks = 'bookmarks';
  static const String readingHistory = 'reading_history';
  static const String rememberCredentials = 'remember_credentials';

  static const String notificationsEnabled = 'notifications_enabled';
  static const String pushNotificationsEnabled = 'push_notifications_enabled';
  static const String emailNotificationsEnabled = 'email_notifications_enabled';
  static const String smsNotificationsEnabled = 'sms_notifications_enabled';
  static const String inAppNotificationsEnabled = 'in_app_notifications_enabled';
  static const String soundEnabled = 'sound_enabled';
  static const String vibrationEnabled = 'vibration_enabled';
  static const String notificationSound = 'notification_sound';

  static const String biometricAuthEnabled = 'biometric_auth_enabled';
  static const String autoLockEnabled = 'auto_lock_enabled';
  static const String autoLockTimeout = 'auto_lock_timeout';
  static const String analyticsEnabled = 'analytics_enabled';
  static const String crashReportingEnabled = 'crash_reporting_enabled';
  static const String dataCollectionEnabled = 'data_collection_enabled';

  static const String autoSyncEnabled = 'auto_sync_enabled';
  static const String offlineModeEnabled = 'offline_mode_enabled';
  static const String dataSaverEnabled = 'data_saver_enabled';
  static const String wifiOnlySync = 'wifi_only_sync';
  static const String backgroundSyncEnabled = 'background_sync_enabled';
  static const String autoBackupEnabled = 'auto_backup_enabled';

  static const String animationsEnabled = 'animations_enabled';
  static const String hapticFeedbackEnabled = 'haptic_feedback_enabled';
  static const String showTutorials = 'show_tutorials';
  static const String showTips = 'show_tips';
  static const String compactMode = 'compact_mode';
  static const String gridViewEnabled = 'grid_view_enabled';

  static const String imageCachingEnabled = 'image_caching_enabled';
  static const String dataCompressionEnabled = 'data_compression_enabled';
  static const String preloadContent = 'preload_content';
  static const String maxCacheSize = 'max_cache_size';
  static const String imageQuality = 'image_quality';

  static const String debugModeEnabled = 'debug_mode_enabled';
  static const String loggingEnabled = 'logging_enabled';
  static const String showPerformanceOverlay = 'show_performance_overlay';
  static const String showWidgetInspector = 'show_widget_inspector';

  static const String lastSyncTime = 'last_sync_time';
  static const String cacheVersion = 'cache_version';
  static const String syncFrequency = 'sync_frequency';
  static const String lastBackupTime = 'last_backup_time';

  static const String highContrastEnabled = 'high_contrast_enabled';
  static const String largeTextEnabled = 'large_text_enabled';
  static const String screenReaderEnabled = 'screen_reader_enabled';
  static const String reduceMotionEnabled = 'reduce_motion_enabled';

  static const String socialSharingEnabled = 'social_sharing_enabled';
  static const String autoShareEnabled = 'auto_share_enabled';
  static const String socialPlatforms = 'social_platforms';
  static const String profileVisibility = 'profile_visibility';

  static const String contentLanguage = 'content_language';
  static const String contentRegion = 'content_region';
  static const String adultContentEnabled = 'adult_content_enabled';
  static const String contentFiltering = 'content_filtering';
}
