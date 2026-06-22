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

import '../models/setting_item.dart';

/// Base settings that are common to all apps
/// These settings include theme, language, and other universal preferences
class BaseSettings {
  static const String categoryGeneral = 'general';
  static const String categoryAppearance = 'appearance';
  static const String categoryLanguage = 'language';

  /// Get all base settings
  static List<SettingItem> getBaseSettings() {
    return [
      // Theme settings
      SettingItem.toggle(
        key: 'theme_dark_mode',
        name: 'Dark Mode',
        description: 'Enable dark theme for the application',
        defaultValue: false,
        category: categoryAppearance,
        isRequired: true,
      ),

      // Language settings
      SettingItem.select(
        key: 'language',
        name: 'Language',
        description: 'Select application language',
        options: ['en', 'zh'],
        defaultValue: 'zh',
        labels: {
          'en': 'English',
          'zh': '中文',
        },
        category: categoryLanguage,
        isRequired: true,
      ),

      // Font family setting
      SettingItem.select(
        key: 'font_family',
        name: 'Font Family',
        description: 'Select font family for the application',
        options: ['SFProText', 'Roboto', 'CN_font'],
        defaultValue: 'SFProText',
        labels: {
          'SFProText': 'SF Pro Text',
          'Roboto': 'Roboto',
          'CN_font': 'Chinese Font',
        },
        category: categoryAppearance,
      ),

      // Text direction (for future RTL support)
      SettingItem.toggle(
        key: 'text_direction_rtl',
        name: 'Right-to-Left Text',
        description: 'Enable right-to-left text direction (for RTL languages)',
        defaultValue: false,
        category: categoryAppearance,
      ),

      // Notification settings
      SettingItem.toggle(
        key: 'notifications_enabled',
        name: 'Enable Notifications',
        description: 'Receive push notifications from the application',
        defaultValue: true,
        category: categoryGeneral,
      ),

      // Sound settings
      SettingItem.toggle(
        key: 'sound_enabled',
        name: 'Enable Sound',
        description: 'Play sounds for notifications and interactions',
        defaultValue: true,
        category: categoryGeneral,
      ),

      // Vibration settings
      SettingItem.toggle(
        key: 'vibration_enabled',
        name: 'Enable Vibration',
        description: 'Vibrate device for notifications and interactions',
        defaultValue: true,
        category: categoryGeneral,
      ),

      // Auto-save settings
      SettingItem.toggle(
        key: 'auto_save_enabled',
        name: 'Auto-Save',
        description: 'Automatically save changes and progress',
        defaultValue: true,
        category: categoryGeneral,
      ),

      // Debug mode
      SettingItem.toggle(
        key: 'debug_mode_enabled',
        name: 'Debug Mode',
        description: 'Enable debug features and logging (for developers)',
        defaultValue: false,
        category: categoryGeneral,
      ),

      // Performance settings
      SettingItem.select(
        key: 'performance_mode',
        name: 'Performance Mode',
        description: 'Select performance optimization level',
        options: ['low', 'medium', 'high'],
        defaultValue: 'medium',
        labels: {
          'low': 'Low (Battery Saver)',
          'medium': 'Medium (Balanced)',
          'high': 'High (Performance)',
        },
        category: categoryGeneral,
      ),

      // Send message button setting
      SettingItem.toggle(
        key: 'send_message_enabled',
        name: 'Enable Send Message',
        description: 'Enable send message button functionality in chat details',
        defaultValue: false,
        category: categoryGeneral,
      ),
    ];
  }

  /// Get base settings grouped by category
  static Map<String, List<SettingItem>> getBaseSettingsByCategory() {
    final settings = getBaseSettings();
    final Map<String, List<SettingItem>> grouped = {};

    for (final setting in settings) {
      final category = setting.category ?? 'other';
      grouped.putIfAbsent(category, () => []);
      grouped[category]!.add(setting);
    }

    return grouped;
  }

  /// Get base setting by key
  static SettingItem? getBaseSetting(String key) {
    return getBaseSettings().firstWhere(
      (setting) => setting.key == key,
      orElse: () => throw ArgumentError('Base setting with key "$key" not found'),
    );
  }

  /// Check if a key is a base setting
  static bool isBaseSetting(String key) {
    return getBaseSettings().any((setting) => setting.key == key);
  }

  /// Get all base setting keys
  static List<String> getBaseSettingKeys() {
    return getBaseSettings().map((setting) => setting.key).toList();
  }

  /// Get default values for all base settings
  static Map<String, dynamic> getBaseDefaults() {
    final Map<String, dynamic> defaults = {};
    for (final setting in getBaseSettings()) {
      defaults[setting.key] = setting.defaultValue;
    }
    return defaults;
  }
}
