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

// CREATED BY: AI Assistant for app-specific SharedPreferences
// NOTE FOR OTHER AIs: This provides AChat-specific SharedPreferences instance
// Each app should have its own prefs to avoid conflicts

import 'package:shared_preferences/shared_preferences.dart';
import 'package:qyflutter/common/storage_tools/app_prefs_base.dart';
import 'constants.dart';

/// AChat app specific SharedPreferences wrapper
/// Provides isolated SharedPreferences instance for AChat app
/// 
/// IMPORTANT: This class no longer requires manual initialization
/// SharedPreferences is automatically initialized by runCommonApp after Flutter binding is ready
/// 
/// USAGE:
/// - No need to call initialize() manually
/// - The setInstance() method is called automatically by runCommonApp
/// - All get/set operations will work automatically once runCommonApp completes
/// 
/// DESIGN:
/// - Uses app-specific prefix to avoid conflicts with other apps
/// - Provides type-safe access to SharedPreferences values
/// - Handles initialization state automatically
/// - Extends AppPrefsBase to ensure compatibility with common app system
class PrefsAppAChat extends AppPrefsBase {
  SharedPreferences? _instance;
  bool _isInitialized = false;
  
  // Singleton instance for Provider usage
  static final PrefsAppAChat _singleton = PrefsAppAChat._internal();
  
  factory PrefsAppAChat() {
    return _singleton;
  }
  
  PrefsAppAChat._internal();

  /// Get SharedPreferences instance for AChat app
  SharedPreferences get instance {
    if (_instance == null) {
      throw Exception('PrefsAppAChat not initialized. Ensure runCommonApp has completed.');
    }
    return _instance!;
  }

  /// Check if initialized
  @override
  bool get isInitialized => _isInitialized;

  /// Initialize SharedPreferences for the app
  /// 
  /// This method automatically generates the SharedPreferences instance
  /// after Flutter binding is ready.
  /// 
  /// USAGE:
  /// - Call this method in main_app_achat.dart after runCommonApp completes
  /// - This ensures the PrefsAppAChat instance is fully ready for use
  /// - Other classes can then use this instance without re-initialization
  /// - Returns the initialized SharedPreferences instance
  @override
  Future<SharedPreferences> initSharedPreferences() async {
    // If already initialized, return the existing instance
    if (_isInitialized && _instance != null) {
      return _instance!;
    }
    
    final prefs = await SharedPreferences.getInstance();
    _instance = prefs;
    _isInitialized = true;
    return prefs;
  }

  /// REQUIRED: Get the currently initialized SharedPreferences instance
  /// 
  /// This method provides access to the SharedPreferences instance that was set
  /// via setInstance() method.
  /// 
  /// IMPLEMENTATION REQUIREMENT:
  /// This method MUST be implemented by all app-specific SharedPreferences classes
  /// and MUST return a valid SharedPreferences instance
  /// 
  /// THROWS:
  /// Exception if not properly initialized
  @override
  SharedPreferences getInstance() {
    if (_instance == null || !_isInitialized) {
      throw Exception('PrefsAppAChat not properly initialized. Ensure runCommonApp has completed.');
    }
    return _instance!;
  }

  /// Get value with AChat prefix
  @override
  T? get<T>(String key, [T? defaultValue]) {
    if (!_isInitialized) return defaultValue;
    
    final prefKey = '${AppConstants.prefsPrefix}$key';
    final value = _instance!.get(prefKey);
    
    if (value is T) {
      return value;
    }
    return defaultValue;
  }

  /// Set value with AChat prefix
  @override
  Future<bool> set<T>(String key, T value) async {
    if (!_isInitialized) return false;
    
    final prefKey = '${AppConstants.prefsPrefix}$key';
    
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
    } else {
      // For complex objects, convert to string
      return await _instance!.setString(prefKey, value.toString());
    }
  }

  /// Remove value with AChat prefix
  @override
  Future<bool> remove(String key) async {
    if (!_isInitialized) return false;
    
    final prefKey = '${AppConstants.prefsPrefix}$key';
    return await _instance!.remove(prefKey);
  }

  /// Check if key exists with AChat prefix
  @override
  bool containsKey(String key) {
    if (!_isInitialized) return false;
    
    final prefKey = '${AppConstants.prefsPrefix}$key';
    return _instance!.containsKey(prefKey);
  }

  /// Get all AChat keys (without prefix)
  @override
  Set<String> getKeys() {
    if (!_isInitialized) return {};
    
    return _instance!.getKeys()
        .where((key) => key.startsWith(AppConstants.prefsPrefix))
        .map((key) => key.replaceFirst(AppConstants.prefsPrefix, ''))
        .toSet();
  }

  /// Clear all AChat preferences
  @override
  Future<void> clearAll() async {
    if (!_isInitialized) return;
    
    final keys = _instance!.getKeys()
        .where((key) => key.startsWith(AppConstants.prefsPrefix));
    
    for (final key in keys) {
      await _instance!.remove(key);
    }
  }

  /// Get string value
  String? getString(String key, [String? defaultValue]) {
    return get<String>(key, defaultValue);
  }

  /// Set string value
  Future<bool> setString(String key, String value) {
    return set<String>(key, value);
  }

  /// Get int value
  int? getInt(String key, [int? defaultValue]) {
    return get<int>(key, defaultValue);
  }

  /// Set int value
  Future<bool> setInt(String key, int value) {
    return set<int>(key, value);
  }

  /// Get double value
  double? getDouble(String key, [double? defaultValue]) {
    return get<double>(key, defaultValue);
  }

  /// Set double value
  Future<bool> setDouble(String key, double value) {
    return set<double>(key, value);
  }

  /// Get bool value
  bool? getBool(String key, [bool? defaultValue]) {
    return get<bool>(key, defaultValue);
  }

  /// Set bool value
  Future<bool> setBool(String key, bool value) {
    return set<bool>(key, value);
  }

  /// Get string list value
  List<String>? getStringList(String key, [List<String>? defaultValue]) {
    return get<List<String>>(key, defaultValue);
  }

  /// Set string list value
  Future<bool> setStringList(String key, List<String> value) {
    return set<List<String>>(key, value);
  }

  /// Batch update multiple values
  Future<void> batchUpdate(Map<String, dynamic> updates) async {
    for (final entry in updates.entries) {
      await set(entry.key, entry.value);
    }
  }

  /// Export all AChat preferences
  Map<String, dynamic> exportAll() {
    if (!_isInitialized) return {};
    
    final result = <String, dynamic>{};
    final keys = getKeys();
    
    for (final key in keys) {
      final value = get(key);
      if (value != null) {
        result[key] = value;
      }
    }
    
    return result;
  }

  /// Import preferences
  Future<void> importAll(Map<String, dynamic> data) async {
    await batchUpdate(data);
  }

  /// Get debug information
  Map<String, dynamic> getDebugInfo() {
    return {
      'isInitialized': _isInitialized,
      'prefix': AppConstants.prefsPrefix,
      'keyCount': getKeys().length,
      'keys': getKeys().toList(),
    };
  }
}
