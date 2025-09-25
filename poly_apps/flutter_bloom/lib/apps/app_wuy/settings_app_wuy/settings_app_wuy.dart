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

import '../../../common/settings/models/setting_item.dart';

/// Wuy App Settings
/// Provides app-specific settings following the unified architecture
class WuyAppSettings {
  static const String appId = 'wuy';
  
  /// Get all Wuy app settings
  static List<SettingItem> getWuySettings() {
    return [
      // General settings
      SettingItem.toggle(
        key: 'wuy_enable_notifications',
        name: 'Enable Notifications',
        description: 'Receive push notifications from Wuy app',
        category: 'general',
        defaultValue: true,
        appId: 'wuy',
      ),
      
      SettingItem.toggle(
        key: 'wuy_enable_sound',
        name: 'Enable Sound',
        description: 'Play sound effects in the app',
        category: 'general',
        defaultValue: true,
        appId: 'wuy',
      ),
      
      SettingItem.toggle(
        key: 'wuy_enable_vibration',
        name: 'Enable Vibration',
        description: 'Enable haptic feedback',
        category: 'general',
        defaultValue: true,
        appId: 'wuy',
      ),
      
      // Display settings
      SettingItem.select(
        key: 'wuy_theme_mode',
        name: 'Theme Mode',
        description: 'Choose app theme',
        category: 'display',
        defaultValue: 'system',
        options: ['light', 'dark', 'system'],
        labels: {
          'light': 'Light',
          'dark': 'Dark',
          'system': 'System',
        },
        appId: 'wuy',
      ),
      
      SettingItem.select(
        key: 'wuy_language',
        name: 'Language',
        description: 'Choose app language',
        category: 'display',
        defaultValue: 'en',
        options: ['en', 'zh'],
        labels: {
          'en': 'English',
          'zh': '中文',
        },
        appId: 'wuy',
      ),
      
      SettingItem.slider(
        key: 'wuy_font_size',
        name: 'Font Size',
        description: 'Adjust text size',
        category: 'display',
        defaultValue: 16.0,
        minValue: 12.0,
        maxValue: 24.0,
        appId: 'wuy',
      ),
      
      // Privacy settings
      SettingItem.toggle(
        key: 'wuy_analytics_enabled',
        name: 'Analytics',
        description: 'Help improve the app by sharing usage data',
        category: 'privacy',
        defaultValue: false,
        appId: 'wuy',
      ),
      
      SettingItem.toggle(
        key: 'wuy_crash_reporting',
        name: 'Crash Reporting',
        description: 'Automatically send crash reports',
        category: 'privacy',
        defaultValue: true,
        appId: 'wuy',
      ),
      
      // Performance settings
      SettingItem.toggle(
        key: 'wuy_enable_animations',
        name: 'Enable Animations',
        description: 'Show smooth animations',
        category: 'performance',
        defaultValue: true,
        appId: 'wuy',
      ),
      
      SettingItem.select(
        key: 'wuy_cache_size',
        name: 'Cache Size',
        description: 'Amount of data to cache',
        category: 'performance',
        defaultValue: '100',
        options: ['50', '100', '200', '500'],
        labels: {
          '50': '50 MB',
          '100': '100 MB',
          '200': '200 MB',
          '500': '500 MB',
        },
        appId: 'wuy',
      ),
      
      // Security settings
      SettingItem.toggle(
        key: 'wuy_biometric_auth',
        name: 'Biometric Authentication',
        description: 'Use fingerprint or face unlock',
        category: 'security',
        defaultValue: false,
        appId: 'wuy',
      ),
      
      SettingItem.select(
        key: 'wuy_auto_lock_time',
        name: 'Auto Lock Time',
        description: 'Time before app locks automatically',
        category: 'security',
        defaultValue: '5',
        options: ['1', '5', '15', '30'],
        labels: {
          '1': '1 minute',
          '5': '5 minutes',
          '15': '15 minutes',
          '30': '30 minutes',
        },
        appId: 'wuy',
      ),
    ];
  }
  
  /// Get settings grouped by category
  static Map<String, List<SettingItem>> getWuySettingsByCategory() {
    final settings = getWuySettings();
    final Map<String, List<SettingItem>> grouped = {};
    
    for (final setting in settings) {
      final category = setting.category ?? 'other';
      grouped.putIfAbsent(category, () => []);
      grouped[category]!.add(setting);
    }
    
    return grouped;
  }
  
  /// Get setting by key
  static SettingItem? getWuySettingByKey(String key) {
    final settings = getWuySettings();
    try {
      return settings.firstWhere((setting) => setting.key == key);
    } catch (e) {
      return null;
    }
  }
  
  /// Get all setting keys
  static List<String> getWuySettingKeys() {
    return getWuySettings().map((setting) => setting.key).toList();
  }
  
  /// Get settings for specific category
  static List<SettingItem> getWuySettingsForCategory(String category) {
    return getWuySettings().where((setting) => setting.category == category).toList();
  }
  
  /// Get available categories
  static List<String> getWuySettingCategories() {
    final categories = getWuySettings()
        .map((setting) => setting.category ?? 'other')
        .toSet()
        .toList();
    categories.sort();
    return categories;
  }
}
