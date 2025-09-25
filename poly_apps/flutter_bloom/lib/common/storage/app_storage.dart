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

import 'storage_manager.dart';

/// High-level convenience wrapper for common app storage use-cases.
/// Delegates to `StorageManager` (Hive backend by default).
class AppStorage {
  // Default common box names
  static const String appSettingsBox = 'app_settings';
  static const String userBox = 'user_data';
  static const String cacheBox = 'app_cache';

  // Common keys
  static const String keyIsFirstLaunch = 'is_first_launch';
  static const String keyAuthToken = 'auth_token';
  static const String keyRefreshToken = 'refresh_token';
  static const String keyLocale = 'current_locale';
  static const String keyThemeMode = 'theme_mode';

  static Future<void> init({String? appName}) async {
    await StorageManager.instance.init(appName: appName);
    await StorageManager.instance.openBox(appSettingsBox);
    await StorageManager.instance.openBox(userBox);
    await StorageManager.instance.openBox(cacheBox);
  }

  // First launch helpers
  static Future<bool> isFirstLaunch() async {
    final value = await StorageManager.instance
        .getValue<bool>(appSettingsBox, keyIsFirstLaunch, defaultValue: true);
    return value ?? true;
  }

  static Future<void> setNotFirstLaunch() async {
    await StorageManager.instance.putValue<bool>(appSettingsBox, keyIsFirstLaunch, false);
  }

  // Auth helpers
  static Future<void> saveTokens({String? accessToken, String? refreshToken}) async {
    if (accessToken != null) {
      await StorageManager.instance.putValue<String>(userBox, keyAuthToken, accessToken);
    }
    if (refreshToken != null) {
      await StorageManager.instance.putValue<String>(userBox, keyRefreshToken, refreshToken);
    }
  }

  static Future<String?> getAccessToken() async {
    return StorageManager.instance.getValue<String>(userBox, keyAuthToken);
  }

  static Future<String?> getRefreshToken() async {
    return StorageManager.instance.getValue<String>(userBox, keyRefreshToken);
  }

  static Future<void> clearAuth() async {
    await StorageManager.instance.deleteKey(userBox, keyAuthToken);
    await StorageManager.instance.deleteKey(userBox, keyRefreshToken);
  }

  // Locale helpers
  static Future<void> setLocale(String localeIdentifier) async {
    await StorageManager.instance.putValue<String>(appSettingsBox, keyLocale, localeIdentifier);
  }

  static Future<String?> getLocale() async {
    return StorageManager.instance.getValue<String>(appSettingsBox, keyLocale);
  }

  // Theme helpers
  static Future<void> setThemeMode(String themeMode) async {
    await StorageManager.instance.putValue<String>(appSettingsBox, keyThemeMode, themeMode);
  }

  static Future<String?> getThemeMode() async {
    return StorageManager.instance.getValue<String>(appSettingsBox, keyThemeMode);
  }

  // Generic helpers
  static Future<T?> get<T>(String box, String key, {T? defaultValue}) async {
    return StorageManager.instance.getValue<T>(box, key, defaultValue: defaultValue);
  }

  static Future<void> set<T>(String box, String key, T value) async {
    await StorageManager.instance.putValue<T>(box, key, value);
  }

  static Future<void> remove(String box, String key) async {
    await StorageManager.instance.deleteKey(box, key);
  }

  static Future<void> clearBox(String box) async {
    await StorageManager.instance.clearBox(box);
  }
}

