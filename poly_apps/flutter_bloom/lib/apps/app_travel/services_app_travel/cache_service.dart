import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../config_app_travel/constants_app_travel.dart';

class CacheService {
  static final CacheService _instance = CacheService._internal();
  SharedPreferences? _prefs;

  factory CacheService() {
    return _instance;
  }

  CacheService._internal();

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  SharedPreferences get prefs {
    if (_prefs == null) {
      throw Exception('CacheService not initialized. Call init() first.');
    }
    return _prefs!;
  }

  Future<bool> setString(String key, String value) async {
    return await prefs.setString(_buildKey(key), value);
  }

  String? getString(String key) {
    return prefs.getString(_buildKey(key));
  }

  Future<bool> setInt(String key, int value) async {
    return await prefs.setInt(_buildKey(key), value);
  }

  int? getInt(String key) {
    return prefs.getInt(_buildKey(key));
  }

  Future<bool> setBool(String key, bool value) async {
    return await prefs.setBool(_buildKey(key), value);
  }

  bool? getBool(String key) {
    return prefs.getBool(_buildKey(key));
  }

  Future<bool> setDouble(String key, double value) async {
    return await prefs.setDouble(_buildKey(key), value);
  }

  double? getDouble(String key) {
    return prefs.getDouble(_buildKey(key));
  }

  Future<bool> setStringList(String key, List<String> value) async {
    return await prefs.setStringList(_buildKey(key), value);
  }

  List<String>? getStringList(String key) {
    return prefs.getStringList(_buildKey(key));
  }

  Future<bool> setJson(String key, Map<String, dynamic> value) async {
    return await setString(key, json.encode(value));
  }

  Map<String, dynamic>? getJson(String key) {
    final String? jsonString = getString(key);
    if (jsonString != null) {
      try {
        return json.decode(jsonString);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  Future<bool> remove(String key) async {
    return await prefs.remove(_buildKey(key));
  }

  Future<bool> clear() async {
    return await prefs.clear();
  }

  bool containsKey(String key) {
    return prefs.containsKey(_buildKey(key));
  }

  Set<String> getKeys() {
    return prefs.getKeys();
  }

  String _buildKey(String key) {
    return '${TravelAppConstants.prefsPrefix}$key';
  }

  Future<void> saveFavorites(List<String> favorites) async {
    await setStringList(TravelAppConstants.keyUserFavorites, favorites);
  }

  List<String> getFavorites() {
    return getStringList(TravelAppConstants.keyUserFavorites) ?? [];
  }

  Future<void> saveBookmarks(List<String> bookmarks) async {
    await setStringList(TravelAppConstants.keyUserBookmarks, bookmarks);
  }

  List<String> getBookmarks() {
    return getStringList(TravelAppConstants.keyUserBookmarks) ?? [];
  }

  Future<void> saveCurrentCity(String city) async {
    await setString(TravelAppConstants.keyCurrentCity, city);
  }

  String? getCurrentCity() {
    return getString(TravelAppConstants.keyCurrentCity);
  }

  Future<void> saveSearchHistory(List<String> history) async {
    await setStringList(TravelAppConstants.keySearchHistory, history);
  }

  List<String> getSearchHistory() {
    return getStringList(TravelAppConstants.keySearchHistory) ?? [];
  }
}
