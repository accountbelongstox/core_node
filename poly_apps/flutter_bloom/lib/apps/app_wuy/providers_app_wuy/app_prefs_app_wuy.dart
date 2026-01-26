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
import '../../../common/storage_tools/app_prefs_base.dart';

/// App-specific SharedPreferences implementation for Wuy App
/// 
/// This class provides app-specific SharedPreferences functionality
/// with proper key prefixing to avoid conflicts with other apps.
class AppPrefsAppWuy extends AppPrefsBase {
  static AppPrefsAppWuy? _instance;
  static AppPrefsAppWuy get instance => _instance ??= AppPrefsAppWuy._internal();
  
  AppPrefsAppWuy._internal();
  
  SharedPreferences? _prefs;
  static const String _appPrefix = 'wuy_';
  
  @override
  bool get isInitialized => _prefs != null;
  
  @override
  Future<SharedPreferences> initSharedPreferences() async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }
  
  @override
  SharedPreferences getInstance() {
    if (_prefs == null) {
      throw Exception('SharedPreferences not initialized. Call initSharedPreferences() first.');
    }
    return _prefs!;
  }
  
  @override
  T? get<T>(String key, [T? defaultValue]) {
    if (!isInitialized) return defaultValue;
    
    final String prefixedKey = '$_appPrefix$key';
    
    if (T == bool) {
      return _prefs!.getBool(prefixedKey) as T? ?? defaultValue;
    } else if (T == int) {
      return _prefs!.getInt(prefixedKey) as T? ?? defaultValue;
    } else if (T == double) {
      return _prefs!.getDouble(prefixedKey) as T? ?? defaultValue;
    } else if (T == String) {
      return _prefs!.getString(prefixedKey) as T? ?? defaultValue;
    } else if (T == const (List<String>,)) {
      return _prefs!.getStringList(prefixedKey) as T? ?? defaultValue;
    } else {
      return defaultValue;
    }
  }
  
  @override
  Future<bool> set<T>(String key, T value) async {
    if (!isInitialized) return false;
    
    final String prefixedKey = '$_appPrefix$key';
    
    if (T == bool) {
      return await _prefs!.setBool(prefixedKey, value as bool);
    } else if (T == int) {
      return await _prefs!.setInt(prefixedKey, value as int);
    } else if (T == double) {
      return await _prefs!.setDouble(prefixedKey, value as double);
    } else if (T == String) {
      return await _prefs!.setString(prefixedKey, value as String);
    } else if (T == const (List<String>,)) {
      return await _prefs!.setStringList(prefixedKey, value as List<String>);
    } else {
      return false;
    }
  }
  
  @override
  Future<bool> remove(String key) async {
    if (!isInitialized) return false;
    
    final String prefixedKey = '$_appPrefix$key';
    return await _prefs!.remove(prefixedKey);
  }
  
  @override
  bool containsKey(String key) {
    if (!isInitialized) return false;
    
    final String prefixedKey = '$_appPrefix$key';
    return _prefs!.containsKey(prefixedKey);
  }
  
  @override
  Set<String> getKeys() {
    if (!isInitialized) return <String>{};
    
    return _prefs!.getKeys()
        .where((String key) => key.startsWith(_appPrefix))
        .map((String key) => key.substring(_appPrefix.length))
        .toSet();
  }
  
  @override
  Future<void> clearAll() async {
    if (!isInitialized) return;
    
    final Set<String> keys = _prefs!.getKeys()
        .where((String key) => key.startsWith(_appPrefix))
        .toSet();
    
    for (final String key in keys) {
      await _prefs!.remove(key);
    }
  }
  
  /// Get app-specific preference with type safety
  T? getAppPreference<T>(String key, [T? defaultValue]) {
    return get<T>(key, defaultValue);
  }
  
  /// Set app-specific preference with type safety
  Future<bool> setAppPreference<T>(String key, T value) async {
    return await set<T>(key, value);
  }
  
  /// Check if app-specific preference exists
  bool hasAppPreference(String key) {
    return containsKey(key);
  }
  
  /// Remove app-specific preference
  Future<bool> removeAppPreference(String key) async {
    return await remove(key);
  }
  
  /// Get all app-specific preferences as a map
  Map<String, dynamic> getAllAppPreferences() {
    if (!isInitialized) return <String, dynamic>{};
    
    final Map<String, dynamic> preferences = <String, dynamic>{};
    final Set<String> keys = getKeys();
    
    for (final String key in keys) {
      final String prefixedKey = '$_appPrefix$key';
      final dynamic value = _prefs!.get(prefixedKey);
      if (value != null) {
        preferences[key] = value;
      }
    }
    
    return preferences;
  }
  
  /// Clear all app-specific preferences
  Future<void> clearAllAppPreferences() async {
    await clearAll();
  }
}
