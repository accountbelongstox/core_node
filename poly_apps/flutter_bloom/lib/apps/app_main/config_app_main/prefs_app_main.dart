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

import 'package:shared_preferences/shared_preferences.dart';
import 'package:qyflutter/common/storage_tools/app_prefs_base.dart';

/// Main App SharedPreferences implementation
/// Extends AppPrefsBase to provide app-specific preferences management
class PrefsAppMain extends AppPrefsBase {
  static const String _keyPrefix = 'main_';
  SharedPreferences? _instance;
  bool _isInitialized = false;

  // Main app specific preference keys
  static const String _keyShowcaseMode = '${_keyPrefix}showcase_mode';
  static const String _keyDeveloperMode = '${_keyPrefix}developer_mode';
  static const String _keyLastSelectedApp = '${_keyPrefix}last_selected_app';
  static const String _keyAppSwitchingEnabled = '${_keyPrefix}app_switching_enabled';
  static const String _keyShowAllApps = '${_keyPrefix}show_all_apps';
  static const String _keyMainAppLaunchCount = '${_keyPrefix}launch_count';
  static const String _keyLastMainAppVersion = '${_keyPrefix}last_version';

  @override
  bool get isInitialized => _isInitialized;

  @override
  Future<SharedPreferences> initSharedPreferences() async {
    _instance = await SharedPreferences.getInstance();
    _isInitialized = true;
    return _instance!;
  }

  @override
  SharedPreferences getInstance() {
    if (_instance == null) {
      throw Exception('PrefsAppMain not initialized. Ensure runCommonApp has completed.');
    }
    return _instance!;
  }

  @override
  T? get<T>(String key, [T? defaultValue]) {
    if (!_isInitialized) return defaultValue;

    final prefKey = '$_keyPrefix$key';

    if (T == String) {
      return _instance!.getString(prefKey) as T? ?? defaultValue;
    } else if (T == int) {
      return _instance!.getInt(prefKey) as T? ?? defaultValue;
    } else if (T == double) {
      return _instance!.getDouble(prefKey) as T? ?? defaultValue;
    } else if (T == bool) {
      return _instance!.getBool(prefKey) as T? ?? defaultValue;
    } else if (T == List<String>) {
      return _instance!.getStringList(prefKey) as T? ?? defaultValue;
    }

    return defaultValue;
  }

  @override
  Future<bool> set<T>(String key, T value) async {
    if (!_isInitialized) return false;

    final prefKey = '$_keyPrefix$key';

    if (value is String) {
      return await _instance!.setString(prefKey, value);
    } else if (value is int) {
      return await _instance!.setInt(prefKey, value);
    } else if (value is double) {
      return await _instance!.setDouble(prefKey, value);
    } else if (value is bool) {
      return await _instance!.setBool(prefKey, value);
    } else if (value is List<String>) {
      return await _instance!.setStringList(prefKey, value);
    }

    return false;
  }

  @override
  Future<bool> remove(String key) async {
    if (!_isInitialized) return false;

    final prefKey = '$_keyPrefix$key';
    return await _instance!.remove(prefKey);
  }

  @override
  bool containsKey(String key) {
    if (!_isInitialized) return false;

    final prefKey = '$_keyPrefix$key';
    return _instance!.containsKey(prefKey);
  }

  @override
  Set<String> getKeys() {
    if (!_isInitialized) return {};

    return _instance!.getKeys()
        .where((key) => key.startsWith(_keyPrefix))
        .map((key) => key.replaceFirst(_keyPrefix, ''))
        .toSet();
  }

  @override
  Future<void> clearAll() async {
    if (!_isInitialized) return;

    final keys = _instance!.getKeys()
        .where((key) => key.startsWith(_keyPrefix));

    for (final key in keys) {
      await _instance!.remove(key);
    }
  }

  // Main app specific methods
  
  /// Get showcase mode setting
  bool getShowcaseMode() {
    return _instance?.getBool(_keyShowcaseMode) ?? true;
  }

  /// Set showcase mode setting
  Future<bool> setShowcaseMode(bool enabled) async {
    return await _instance?.setBool(_keyShowcaseMode, enabled) ?? false;
  }

  /// Get developer mode setting
  bool getDeveloperMode() {
    return _instance?.getBool(_keyDeveloperMode) ?? false;
  }

  /// Set developer mode setting
  Future<bool> setDeveloperMode(bool enabled) async {
    return await _instance?.setBool(_keyDeveloperMode, enabled) ?? false;
  }
  
  /// Get last selected app
  String? getLastSelectedApp() {
    return _instance?.getString(_keyLastSelectedApp);
  }

  /// Set last selected app
  Future<bool> setLastSelectedApp(String appId) async {
    return await _instance?.setString(_keyLastSelectedApp, appId) ?? false;
  }

  /// Get app switching enabled setting
  bool getAppSwitchingEnabled() {
    return _instance?.getBool(_keyAppSwitchingEnabled) ?? true;
  }

  /// Set app switching enabled setting
  Future<bool> setAppSwitchingEnabled(bool enabled) async {
    return await _instance?.setBool(_keyAppSwitchingEnabled, enabled) ?? false;
  }

  /// Get show all apps setting
  bool getShowAllApps() {
    return _instance?.getBool(_keyShowAllApps) ?? true;
  }

  /// Set show all apps setting
  Future<bool> setShowAllApps(bool enabled) async {
    return await _instance?.setBool(_keyShowAllApps, enabled) ?? false;
  }

  /// Get main app launch count
  int getMainAppLaunchCount() {
    return _instance?.getInt(_keyMainAppLaunchCount) ?? 0;
  }

  /// Set main app launch count
  Future<bool> setMainAppLaunchCount(int count) async {
    return await _instance?.setInt(_keyMainAppLaunchCount, count) ?? false;
  }
  
  /// Increment main app launch count
  Future<bool> incrementMainAppLaunchCount() async {
    final currentCount = getMainAppLaunchCount();
    return await setMainAppLaunchCount(currentCount + 1);
  }
  
  /// Get last main app version
  String? getLastMainAppVersion() {
    return _instance?.getString(_keyLastMainAppVersion);
  }

  /// Set last main app version
  Future<bool> setLastMainAppVersion(String version) async {
    return await _instance?.setString(_keyLastMainAppVersion, version) ?? false;
  }

  /// Clear all main app specific preferences
  Future<bool> clearMainAppPrefs() async {
    if (_instance == null) return false;

    final keys = _instance!.getKeys().where((key) => key.startsWith(_keyPrefix));
    for (final key in keys) {
      await _instance!.remove(key);
    }
    return true;
  }
}
