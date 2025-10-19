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

/// QY App specific settings configuration
class QyAppSettings {
  static const String appId = 'example';
  static const String categoryExampleGeneral = 'qy_general';
  static const String categoryExampleDisplay = 'qy_display';
  static const String categoryExampleNotifications = 'qy_notifications';
  static const String categoryExamplePrivacy = 'qy_privacy';

  /// Get QY app specific settings
  static List<SettingItem> getQyAppSettings() {
    return [
      // General settings
      SettingItem.toggle(
        key: 'qy_auto_sync',
        name: 'Auto Sync',
        description: 'Automatically sync data in background',
        defaultValue: true,
        category: categoryExampleGeneral,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'qy_offline_mode',
        name: 'Offline Mode',
        description: 'Enable offline functionality',
        defaultValue: false,
        category: categoryExampleGeneral,
        appId: appId,
      ),

      SettingItem.select(
        key: 'qy_sync_frequency',
        name: 'Sync Frequency',
        description: 'How often to sync data',
        options: ['manual', '15min', '30min', '1hour', '6hours'],
        defaultValue: '30min',
        labels: {
          'manual': 'Manual',
          '15min': 'Every 15 minutes',
          '30min': 'Every 30 minutes',
          '1hour': 'Every hour',
          '6hours': 'Every 6 hours',
        },
        category: categoryExampleGeneral,
        appId: appId,
      ),

      // Display settings
      SettingItem.select(
        key: 'qy_view_mode',
        name: 'View Mode',
        description: 'Default view mode for content',
        options: ['list', 'grid', 'card'],
        defaultValue: 'list',
        labels: {
          'list': 'List View',
          'grid': 'Grid View',
          'card': 'Card View',
        },
        category: categoryExampleDisplay,
        appId: appId,
      ),

      SettingItem.slider(
        key: 'qy_items_per_page',
        name: 'Items Per Page',
        description: 'Number of items to display per page',
        defaultValue: 20.0,
        minValue: 10.0,
        maxValue: 100.0,
        category: categoryExampleDisplay,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'qy_show_thumbnails',
        name: 'Show Thumbnails',
        description: 'Display thumbnails in list view',
        defaultValue: true,
        category: categoryExampleDisplay,
        appId: appId,
      ),

      SettingItem.select(
        key: 'qy_image_quality',
        name: 'Image Quality',
        description: 'Quality of displayed images',
        options: ['low', 'medium', 'high', 'original'],
        defaultValue: 'high',
        labels: {
          'low': 'Low (Fast Loading)',
          'medium': 'Medium',
          'high': 'High',
          'original': 'Original (Best Quality)',
        },
        category: categoryExampleDisplay,
        appId: appId,
      ),

      // Notification settings
      SettingItem.toggle(
        key: 'qy_push_notifications',
        name: 'Push Notifications',
        description: 'Receive push notifications',
        defaultValue: true,
        category: categoryExampleNotifications,
        appId: appId,
      ),

      SettingItem.checkbox(
        key: 'qy_notification_types',
        name: 'Notification Types',
        description: 'Select which types of notifications to receive',
        options: ['updates', 'reminders', 'messages', 'alerts', 'promotions'],
        defaultValue: ['updates', 'reminders', 'messages'],
        labels: {
          'updates': 'App Updates',
          'reminders': 'Reminders',
          'messages': 'Messages',
          'alerts': 'Important Alerts',
          'promotions': 'Promotions',
        },
        category: categoryExampleNotifications,
        appId: appId,
      ),

      SettingItem.select(
        key: 'qy_notification_sound',
        name: 'Notification Sound',
        description: 'Sound for notifications',
        options: ['default', 'chime', 'bell', 'none'],
        defaultValue: 'default',
        labels: {
          'default': 'Default',
          'chime': 'Chime',
          'bell': 'Bell',
          'none': 'Silent',
        },
        category: categoryExampleNotifications,
        appId: appId,
      ),

      // Privacy settings
      SettingItem.select(
        key: 'qy_privacy_level',
        name: 'Privacy Level',
        description: 'Default privacy level for content',
        options: ['public', 'friends', 'private'],
        defaultValue: 'friends',
        labels: {
          'public': 'Public',
          'friends': 'Friends Only',
          'private': 'Private',
        },
        category: categoryExamplePrivacy,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'qy_analytics_enabled',
        name: 'Analytics',
        description: 'Allow anonymous usage analytics',
        defaultValue: true,
        category: categoryExamplePrivacy,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'qy_crash_reporting',
        name: 'Crash Reporting',
        description: 'Send crash reports to help improve the app',
        defaultValue: true,
        category: categoryExamplePrivacy,
        appId: appId,
      ),

      SettingItem.select(
        key: 'qy_data_retention',
        name: 'Data Retention',
        description: 'How long to keep local data',
        options: ['1week', '1month', '3months', '1year', 'forever'],
        defaultValue: '3months',
        labels: {
          '1week': '1 Week',
          '1month': '1 Month',
          '3months': '3 Months',
          '1year': '1 Year',
          'forever': 'Forever',
        },
        category: categoryExamplePrivacy,
        appId: appId,
      ),

      // Advanced settings
      SettingItem.textInput(
        key: 'qy_custom_api_endpoint',
        name: 'Custom API Endpoint',
        description: 'Custom API endpoint (advanced users only)',
        defaultValue: '',
        category: categoryExampleGeneral,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'qy_debug_mode',
        name: 'Debug Mode',
        description: 'Enable debug information (for developers)',
        defaultValue: false,
        category: categoryExampleGeneral,
        appId: appId,
      ),
    ];
  }

  /// Get QY settings grouped by category
  static Map<String, List<SettingItem>> getExampleSettingsByCategory() {
    final settings = getQyAppSettings();
    final Map<String, List<SettingItem>> grouped = {};

    for (final setting in settings) {
      final category = setting.category ?? 'other';
      grouped.putIfAbsent(category, () => []);
      grouped[category]!.add(setting);
    }

    return grouped;
  }

  /// Get QY setting by key
  static SettingItem? getExampleSetting(String key) {
    try {
      return getQyAppSettings().firstWhere(
        (setting) => setting.key == key,
      );
    } catch (e) {
      return null;
    }
  }

  /// Get all QY setting keys
  static List<String> getExampleSettingKeys() {
    return getQyAppSettings().map((setting) => setting.key).toList();
  }

  /// Get default values for QY settings
  static Map<String, dynamic> getExampleDefaults() {
    final Map<String, dynamic> defaults = {};
    for (final setting in getQyAppSettings()) {
      defaults[setting.key] = setting.defaultValue;
    }
    return defaults;
  }
}
