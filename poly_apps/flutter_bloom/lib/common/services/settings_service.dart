/// Centralized settings service with reactive updates
/// Provides persistent settings storage and real-time app refresh
library;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsService extends ChangeNotifier {
  static final SettingsService _instance = SettingsService._internal();
  factory SettingsService() => _instance;
  SettingsService._internal();

  SharedPreferences? _prefs;

  String _language = 'zh';
  ThemeMode _themeMode = ThemeMode.light;
  bool _notificationsEnabled = true;
  bool _soundEnabled = true;
  double _fontSize = 16.0;

  String get language => _language;
  ThemeMode get themeMode => _themeMode;
  bool get notificationsEnabled => _notificationsEnabled;
  bool get soundEnabled => _soundEnabled;
  double get fontSize => _fontSize;

  bool get isDarkMode => _themeMode == ThemeMode.dark;

  /// Initialize settings from storage
  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    await _loadSettings();
  }

  /// Load settings from storage
  Future<void> _loadSettings() async {
    if (_prefs == null) return;

    _language = _prefs!.getString('language') ?? 'zh';
    _themeMode = ThemeMode.values[_prefs!.getInt('themeMode') ?? 0];
    _notificationsEnabled = _prefs!.getBool('notificationsEnabled') ?? true;
    _soundEnabled = _prefs!.getBool('soundEnabled') ?? true;
    _fontSize = _prefs!.getDouble('fontSize') ?? 16.0;

    notifyListeners();
  }

  /// Set language
  Future<void> setLanguage(String language) async {
    if (_language != language) {
      _language = language;
      await _prefs?.setString('language', language);
      notifyListeners();
    }
  }

  /// Set theme mode
  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode != mode) {
      _themeMode = mode;
      await _prefs?.setInt('themeMode', mode.index);
      notifyListeners();
    }
  }

  /// Toggle dark mode
  Future<void> toggleDarkMode() async {
    final newMode = _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    await setThemeMode(newMode);
  }

  /// Set notifications enabled
  Future<void> setNotificationsEnabled(bool enabled) async {
    if (_notificationsEnabled != enabled) {
      _notificationsEnabled = enabled;
      await _prefs?.setBool('notificationsEnabled', enabled);
      notifyListeners();
    }
  }

  /// Set sound enabled
  Future<void> setSoundEnabled(bool enabled) async {
    if (_soundEnabled != enabled) {
      _soundEnabled = enabled;
      await _prefs?.setBool('soundEnabled', enabled);
      notifyListeners();
    }
  }

  /// Set font size
  Future<void> setFontSize(double size) async {
    if (_fontSize != size) {
      _fontSize = size;
      await _prefs?.setDouble('fontSize', size);
      notifyListeners();
    }
  }

  /// Reset to defaults
  Future<void> resetToDefaults() async {
    _language = 'zh';
    _themeMode = ThemeMode.light;
    _notificationsEnabled = true;
    _soundEnabled = true;
    _fontSize = 16.0;

    await _prefs?.clear();
    await _loadSettings();
    notifyListeners();
  }

  /// Get setting value by key
  T? getSetting<T>(String key, {T? defaultValue}) {
    if (_prefs == null) return defaultValue;

    try {
      if (T == String) {
        return _prefs!.getString(key) as T? ?? defaultValue;
      } else if (T == int) {
        return _prefs!.getInt(key) as T? ?? defaultValue;
      } else if (T == double) {
        return _prefs!.getDouble(key) as T? ?? defaultValue;
      } else if (T == bool) {
        return _prefs!.getBool(key) as T? ?? defaultValue;
      }
    } catch (e) {
      return defaultValue;
    }

    return defaultValue;
  }

  /// Set setting value by key
  Future<void> setSetting<T>(String key, T value) async {
    if (_prefs == null) return;

    try {
      if (value is String) {
        await _prefs!.setString(key, value);
      } else if (value is int) {
        await _prefs!.setInt(key, value);
      } else if (value is double) {
        await _prefs!.setDouble(key, value);
      } else if (value is bool) {
        await _prefs!.setBool(key, value);
      }
      notifyListeners();
    } catch (e) {
      // Handle error
    }
  }
}