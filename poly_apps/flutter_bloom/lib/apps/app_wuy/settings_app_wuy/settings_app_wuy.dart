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
/// NOTE: Settings are available before login - stored in UnifiedStorage
class WuyAppSettings {
  static const String appId = 'wuy';

  /// Get all Wuy app settings
  static List<SettingItem> getWuySettings() {
    return [
      // Location & Privacy settings
      SettingItem.toggle(
        key: 'wuy_location_sharing',
        name: 'Location Sharing',
        description: 'Share your location with friends',
        category: 'privacy',
        defaultValue: false,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_location_history',
        name: 'Location History',
        description: 'Save location history for tracking',
        category: 'privacy',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_show_online_status',
        name: 'Show Online Status',
        description: 'Let friends see when you are online',
        category: 'privacy',
        defaultValue: true,
        appId: appId,
      ),

      // Friend & Social settings
      SettingItem.toggle(
        key: 'wuy_friend_requests_notification',
        name: 'Friend Request Notifications',
        description: 'Get notified of new friend requests',
        category: 'social',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.select(
        key: 'wuy_default_map_view',
        name: 'Default Map View',
        description: 'Choose default map view mode',
        category: 'social',
        defaultValue: 'standard',
        options: ['standard', 'satellite', 'hybrid'],
        labels: {
          'standard': 'Standard',
          'satellite': 'Satellite',
          'hybrid': 'Hybrid',
        },
        appId: appId,
      ),

      // Performance & Data settings
      SettingItem.toggle(
        key: 'wuy_enable_animations',
        name: 'Enable Animations',
        description: 'Show smooth animations',
        category: 'performance',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_data_saver_mode',
        name: 'Data Saver Mode',
        description: 'Reduce data usage by limiting media quality',
        category: 'performance',
        defaultValue: false,
        appId: appId,
      ),

      SettingItem.select(
        key: 'wuy_cache_size',
        name: 'Cache Size',
        description: 'Amount of data to cache locally',
        category: 'performance',
        defaultValue: '100',
        options: ['50', '100', '200', '500'],
        labels: {
          '50': '50 MB',
          '100': '100 MB',
          '200': '200 MB',
          '500': '500 MB',
        },
        appId: appId,
      ),

      SettingItem.number(
        key: 'wuy_refresh_interval',
        name: 'Auto Refresh Interval',
        description: 'Minutes between auto refresh',
        category: 'performance',
        defaultValue: 5,
        minIntValue: 1,
        maxIntValue: 60,
        appId: appId,
      ),

      // Security settings
      SettingItem.toggle(
        key: 'wuy_biometric_auth',
        name: 'Biometric Authentication',
        description: 'Use fingerprint or face unlock',
        category: 'security',
        defaultValue: false,
        appId: appId,
      ),

      SettingItem.select(
        key: 'wuy_auto_lock_time',
        name: 'Auto Lock Time',
        description: 'Time before app locks automatically',
        category: 'security',
        defaultValue: '5',
        options: ['never', '1', '5', '15', '30'],
        labels: {
          'never': 'Never',
          '1': '1 minute',
          '5': '5 minutes',
          '15': '15 minutes',
          '30': '30 minutes',
        },
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_require_auth_on_startup',
        name: 'Require Auth on Startup',
        description: 'Require biometric auth when app starts',
        category: 'security',
        defaultValue: false,
        appId: appId,
      ),

      // Chat & Messaging settings
      SettingItem.toggle(
        key: 'wuy_message_preview',
        name: 'Message Previews',
        description: 'Show message content in notifications',
        category: 'messaging',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_typing_indicators',
        name: 'Typing Indicators',
        description: 'Show when someone is typing',
        category: 'messaging',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_read_receipts',
        name: 'Read Receipts',
        description: 'Let others know when you read messages',
        category: 'messaging',
        defaultValue: true,
        appId: appId,
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
