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
import '../localization_app_wuy/localization_keys_app_wuy.dart';

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
        name: LocalizationKeysAppWuy.wuySettingsLocationSharing,
        description: LocalizationKeysAppWuy.wuySettingsLocationSharingDesc,
        category: 'privacy',
        defaultValue: false,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_location_history',
        name: LocalizationKeysAppWuy.wuySettingsLocationHistory,
        description: LocalizationKeysAppWuy.wuySettingsLocationHistoryDesc,
        category: 'privacy',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_show_online_status',
        name: LocalizationKeysAppWuy.wuySettingsShowOnlineStatus,
        description: LocalizationKeysAppWuy.wuySettingsShowOnlineStatusDesc,
        category: 'privacy',
        defaultValue: true,
        appId: appId,
      ),

      // Friend & Social settings
      SettingItem.toggle(
        key: 'wuy_friend_requests_notification',
        name: LocalizationKeysAppWuy.wuySettingsFriendRequestNotif,
        description: LocalizationKeysAppWuy.wuySettingsFriendRequestNotifDesc,
        category: 'social',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.select(
        key: 'wuy_default_map_view',
        name: LocalizationKeysAppWuy.wuySettingsDefaultMapView,
        description: LocalizationKeysAppWuy.wuySettingsDefaultMapViewDesc,
        category: 'social',
        defaultValue: 'standard',
        options: ['standard', 'satellite', 'hybrid'],
        labels: {
          'standard': LocalizationKeysAppWuy.wuyMapViewStandard,
          'satellite': LocalizationKeysAppWuy.wuyMapViewSatellite,
          'hybrid': LocalizationKeysAppWuy.wuyMapViewHybrid,
        },
        appId: appId,
      ),

      // Performance & Data settings
      SettingItem.toggle(
        key: 'wuy_enable_animations',
        name: LocalizationKeysAppWuy.wuySettingsEnableAnimations,
        description: LocalizationKeysAppWuy.wuySettingsEnableAnimationsDesc,
        category: 'performance',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_data_saver_mode',
        name: LocalizationKeysAppWuy.wuySettingsDataSaverMode,
        description: LocalizationKeysAppWuy.wuySettingsDataSaverModeDesc,
        category: 'performance',
        defaultValue: false,
        appId: appId,
      ),

      SettingItem.select(
        key: 'wuy_cache_size',
        name: LocalizationKeysAppWuy.wuySettingsCacheSize,
        description: LocalizationKeysAppWuy.wuySettingsCacheSizeDesc,
        category: 'performance',
        defaultValue: '100',
        options: ['50', '100', '200', '500'],
        labels: {
          '50': LocalizationKeysAppWuy.wuyCacheSize50MB,
          '100': LocalizationKeysAppWuy.wuyCacheSize100MB,
          '200': LocalizationKeysAppWuy.wuyCacheSize200MB,
          '500': LocalizationKeysAppWuy.wuyCacheSize500MB,
        },
        appId: appId,
      ),

      SettingItem.number(
        key: 'wuy_refresh_interval',
        name: LocalizationKeysAppWuy.wuySettingsRefreshInterval,
        description: LocalizationKeysAppWuy.wuySettingsRefreshIntervalDesc,
        category: 'performance',
        defaultValue: 5,
        minIntValue: 1,
        maxIntValue: 60,
        appId: appId,
      ),

      // Security settings
      SettingItem.toggle(
        key: 'wuy_biometric_auth',
        name: LocalizationKeysAppWuy.wuySettingsBiometricAuthName,
        description: LocalizationKeysAppWuy.wuySettingsBiometricAuthDesc,
        category: 'security',
        defaultValue: false,
        appId: appId,
      ),

      SettingItem.select(
        key: 'wuy_auto_lock_time',
        name: LocalizationKeysAppWuy.wuySettingsAutoLockTime,
        description: LocalizationKeysAppWuy.wuySettingsAutoLockTimeDesc,
        category: 'security',
        defaultValue: '5',
        options: ['never', '1', '5', '15', '30'],
        labels: {
          'never': LocalizationKeysAppWuy.wuyAutoLockNever,
          '1': LocalizationKeysAppWuy.wuyAutoLock1Min,
          '5': LocalizationKeysAppWuy.wuyAutoLock5Min,
          '15': LocalizationKeysAppWuy.wuyAutoLock15Min,
          '30': LocalizationKeysAppWuy.wuyAutoLock30Min,
        },
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_require_auth_on_startup',
        name: LocalizationKeysAppWuy.wuySettingsRequireAuthStartup,
        description: LocalizationKeysAppWuy.wuySettingsRequireAuthStartupDesc,
        category: 'security',
        defaultValue: false,
        appId: appId,
      ),

      // Chat & Messaging settings
      SettingItem.toggle(
        key: 'wuy_message_preview',
        name: LocalizationKeysAppWuy.wuySettingsMessagePreview,
        description: LocalizationKeysAppWuy.wuySettingsMessagePreviewDesc,
        category: 'messaging',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_typing_indicators',
        name: LocalizationKeysAppWuy.wuySettingsTypingIndicators,
        description: LocalizationKeysAppWuy.wuySettingsTypingIndicatorsDesc,
        category: 'messaging',
        defaultValue: true,
        appId: appId,
      ),

      SettingItem.toggle(
        key: 'wuy_read_receipts',
        name: LocalizationKeysAppWuy.wuySettingsReadReceipts,
        description: LocalizationKeysAppWuy.wuySettingsReadReceiptsDesc,
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
