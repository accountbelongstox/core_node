import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_storage_service.dart';
import 'package:qyflutter/apps/app_vipclub/settings_app_vipclub/settings_app_vipclub.dart';

class VipClubSettingsController extends ChangeNotifier {
  final VipClubStorageService _storageService = VipClubStorageService();
  final Map<String, dynamic> _settings = {};
  bool _isInitialized = false;

  bool get isInitialized => _isInitialized;

  VipClubSettingsController() {
    _initSettings();
  }

  Future<void> _initSettings() async {
    try {
      await _storageService.init();

      final settings = VipClubSettings.getVipClubSettings();
      for (final setting in settings) {
        final value = await _getSetting(setting.key);
        _settings[setting.key] = value ?? setting.defaultValue;
      }

      _isInitialized = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Error initializing settings: $e');
    }
  }

  Future<dynamic> _getSetting(String key) async {
    try {
      final stringValue = await _storageService.getString(key);
      if (stringValue != null) {
        if (stringValue == 'true') return true;
        if (stringValue == 'false') return false;
        final intValue = int.tryParse(stringValue);
        if (intValue != null) return intValue;
        final doubleValue = double.tryParse(stringValue);
        if (doubleValue != null) return doubleValue;
        return stringValue;
      }

      final boolValue = await _storageService.getBool(key);
      if (boolValue != null) return boolValue;

      final intValue = await _storageService.getInt(key);
      if (intValue != null) return intValue;

      return null;
    } catch (e) {
      debugPrint('Error getting setting $key: $e');
      return null;
    }
  }

  T? getSetting<T>(String key) {
    return _settings[key] as T?;
  }

  Future<void> setSetting(String key, dynamic value) async {
    try {
      _settings[key] = value;

      if (value is bool) {
        await _storageService.setBool(key, value);
      } else if (value is int) {
        await _storageService.setInt(key, value);
      } else if (value is String) {
        await _storageService.setString(key, value);
      } else {
        await _storageService.setString(key, value.toString());
      }

      notifyListeners();
    } catch (e) {
      debugPrint('Error setting $key: $e');
    }
  }

  bool get isDarkMode => getSetting<bool>('theme_dark_mode') ?? false;
  String get language => getSetting<String>('language') ?? 'zh';
  bool get debugMode => getSetting<bool>('vipclub_debug_mode') ?? false;
  bool get notificationsEnabled =>
      getSetting<bool>('vipclub_notifications_enabled') ?? true;
  bool get showSplash => getSetting<bool>('vipclub_show_splash') ?? true;
  bool get autoLogin => getSetting<bool>('vipclub_auto_login') ?? true;
  String get currency => getSetting<String>('vipclub_currency') ?? 'USD';

  Future<void> setDarkMode(bool value) async {
    await setSetting('theme_dark_mode', value);
  }

  Future<void> setLanguage(String value) async {
    await setSetting('language', value);
  }

  Future<void> setDebugMode(bool value) async {
    await setSetting('vipclub_debug_mode', value);
  }

  Future<void> setNotificationsEnabled(bool value) async {
    await setSetting('vipclub_notifications_enabled', value);
  }

  Future<void> setShowSplash(bool value) async {
    await setSetting('vipclub_show_splash', value);
  }

  Future<void> setAutoLogin(bool value) async {
    await setSetting('vipclub_auto_login', value);
  }

  Future<void> setCurrency(String value) async {
    await setSetting('vipclub_currency', value);
  }

  Future<void> resetToDefaults() async {
    final settings = VipClubSettings.getVipClubSettings();
    for (final setting in settings) {
      await setSetting(setting.key, setting.defaultValue);
    }
    notifyListeners();
  }
}
