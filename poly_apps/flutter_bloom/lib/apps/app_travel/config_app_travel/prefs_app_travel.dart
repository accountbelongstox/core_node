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
import 'constants_app_travel.dart';

class PrefsAppTravel extends AppPrefsBase {
  SharedPreferences? _instance;
  bool _isInitialized = false;

  static final PrefsAppTravel _singleton = PrefsAppTravel._internal();

  factory PrefsAppTravel() {
    return _singleton;
  }

  PrefsAppTravel._internal();

  SharedPreferences get instance {
    if (_instance == null) {
      throw Exception('PrefsAppTravel not initialized. Ensure runCommonApp has completed.');
    }
    return _instance!;
  }

  @override
  bool get isInitialized => _isInitialized;

  @override
  Future<SharedPreferences> initSharedPreferences() async {
    if (_isInitialized && _instance != null) {
      return _instance!;
    }

    final prefs = await SharedPreferences.getInstance();
    _instance = prefs;
    _isInitialized = true;
    return prefs;
  }

  @override
  SharedPreferences getInstance() {
    if (_instance == null || !_isInitialized) {
      throw Exception('PrefsAppTravel not properly initialized. Ensure runCommonApp has completed.');
    }
    return _instance!;
  }

  @override
  T? get<T>(String key, [T? defaultValue]) {
    if (!_isInitialized) return defaultValue;

    final prefKey = '${TravelAppConstants.prefsPrefix}$key';
    final value = _instance!.get(prefKey);

    if (value is T) {
      return value;
    }
    return defaultValue;
  }

  @override
  Future<bool> set<T>(String key, T value) async {
    if (!_isInitialized) return false;

    final prefKey = '${TravelAppConstants.prefsPrefix}$key';

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
      return await _instance!.setString(prefKey, value.toString());
    }
  }

  @override
  Future<bool> remove(String key) async {
    if (!_isInitialized) return false;

    final prefKey = '${TravelAppConstants.prefsPrefix}$key';
    return await _instance!.remove(prefKey);
  }

  @override
  Future<bool> clear() async {
    if (!_isInitialized) return false;
    return await _instance!.clear();
  }

  bool contains(String key) {
    if (!_isInitialized) return false;

    final prefKey = '${TravelAppConstants.prefsPrefix}$key';
    return _instance!.containsKey(prefKey);
  }

  @override
  Set<String> getKeys() {
    if (!_isInitialized) return {};
    return _instance!.getKeys();
  }

  @override
  bool containsKey(String key) {
    return contains(key);
  }

  @override
  Future<bool> clearAll() async {
    return await clear();
  }

  String? getString(String key) => get<String>(key);
  int? getInt(String key) => get<int>(key);
  double? getDouble(String key) => get<double>(key);
  bool? getBool(String key) => get<bool>(key);
  List<String>? getStringList(String key) => get<List<String>>(key);

  Future<bool> setString(String key, String value) => set(key, value);
  Future<bool> setInt(String key, int value) => set(key, value);
  Future<bool> setDouble(String key, double value) => set(key, value);
  Future<bool> setBool(String key, bool value) => set(key, value);
  Future<bool> setStringList(String key, List<String> value) => set(key, value);
}
