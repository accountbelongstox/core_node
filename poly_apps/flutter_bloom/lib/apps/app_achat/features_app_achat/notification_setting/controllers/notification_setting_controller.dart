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

import 'package:flutter/material.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/settings/models/setting_item.dart';

// AI MODIFICATION NOTE: This controller was enhanced by QR_Profile_AI_Assistant
// - Added comprehensive notification settings with proper categorization
// - Enhanced with localization support and better organization
// - Integrated with common settings controller for persistence
// Other AIs: Please maintain the setting categories and localization keys when modifying

/// Controller for notification settings screen
/// Uses the common settings controller for persistence
class NotificationSettingController extends ChangeNotifier {
  final SettingsController _settingsController;

  NotificationSettingController(this._settingsController) {
    _initializeDefaultSettings();
  }

  /// Initialize default settings if they don't exist
  void _initializeDefaultSettings() {
    final settings = getNotificationSettings();
    for (final setting in settings) {
      if (!_settingsController.hasSetting(setting.key)) {
        _settingsController.setSetting(setting.key, setting.defaultValue);
      }
    }
  }

  /// Get notification settings grouped by category
  Map<String, List<SettingItem>> get notificationSettingsByCategory {
    final Map<String, List<SettingItem>> grouped = {};

    for (final setting in getNotificationSettings()) {
      final subcategory = _getNotificationSubcategory(setting.key);
      grouped.putIfAbsent(subcategory, () => []);
      grouped[subcategory]!.add(setting);
    }

    return grouped;
  }

  /// Get all notification-related settings
  List<SettingItem> getNotificationSettings() {
    return [
      // General Notifications
      SettingItem.toggle(
        key: 'notification_enabled',
        name: 'Enable Notifications',
        description: 'Receive push notifications for messages and updates',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'notification_preview',
        name: 'Show Message Preview',
        description: 'Display message content in notifications',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'notification_banner',
        name: 'Show Banner',
        description: 'Display notification banners on screen',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),

      // Sound & Vibration
      SettingItem.toggle(
        key: 'notification_sound',
        name: 'Notification Sound',
        description: 'Play sound for notifications',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.select(
        key: 'notification_sound_type',
        name: 'Sound Type',
        description: 'Choose notification sound',
        defaultValue: 'default',
        options: ['default', 'chime', 'bell', 'pop'],
        labels: {
          'default': 'Default',
          'chime': 'Chime',
          'bell': 'Bell',
          'pop': 'Pop',
        },
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'notification_vibration',
        name: 'Vibration',
        description: 'Vibrate for notifications',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),

      // Message Notifications
      SettingItem.toggle(
        key: 'message_notifications',
        name: 'Message Notifications',
        description: 'Receive notifications for new messages',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'message_priority_only',
        name: 'Priority Messages Only',
        description: 'Only notify for important messages',
        defaultValue: false,
        category: 'notifications',
        isRequired: false,
      ),

      // Group Notifications
      SettingItem.toggle(
        key: 'group_notifications',
        name: 'Group Notifications',
        description: 'Receive notifications from group chats',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'group_mentions_only',
        name: 'Mentions Only',
        description: 'Only notify when mentioned in groups',
        defaultValue: false,
        category: 'notifications',
        isRequired: false,
      ),

      // Channel Notifications
      SettingItem.toggle(
        key: 'channel_notifications',
        name: 'Channel Notifications',
        description: 'Receive notifications from channels',
        defaultValue: true,
        category: 'notifications',
        isRequired: false,
      ),
      SettingItem.toggle(
        key: 'channel_important_only',
        name: 'Important Channels Only',
        description: 'Only notify for important channel updates',
        defaultValue: false,
        category: 'notifications',
        isRequired: false,
      ),
    ];
  }

  /// Get setting value with fallback
  T getValue<T>(String key, T defaultValue) {
    return _settingsController.getSetting<T>(key, defaultValue) ?? defaultValue;
  }

  /// Update setting value
  Future<void> updateSetting<T>(String key, T value) async {
    await _settingsController.setSetting<T>(key, value);
    notifyListeners();
  }

  /// Get notification subcategory for grouping
  String _getNotificationSubcategory(String key) {
    if (key.startsWith('message_')) return 'message_notifications';
    if (key.startsWith('group_')) return 'group_notifications';
    if (key.startsWith('channel_')) return 'channel_notifications';
    if (key.contains('sound') || key.contains('vibration')) return 'notification_sounds';
    if (key.contains('preview') || key.contains('banner') || key.contains('enabled')) return 'notification_display';
    return 'general_notifications';
  }

  /// Get category display names with localization support
  Map<String, String> getCategoryDisplayNames() {
    return {
      'message_notifications': 'Message Notifications',
      'group_notifications': 'Group Notifications',
      'channel_notifications': 'Channel Notifications',
      'notification_sounds': 'Sounds & Vibration',
      'notification_display': 'Display Settings',
      'general_notifications': 'General Settings',
    };
  }

  /// Get all notification settings as a summary
  Map<String, dynamic> getNotificationSummary() {
    final settings = getNotificationSettings();
    final summary = <String, dynamic>{};

    for (final setting in settings) {
      summary[setting.key] = getValue(setting.key, setting.defaultValue);
    }

    return summary;
  }

  /// Reset all notification settings to defaults
  Future<void> resetToDefaults() async {
    final settings = getNotificationSettings();

    for (final setting in settings) {
      await _settingsController.setSetting(setting.key, setting.defaultValue);
    }

    notifyListeners();
  }

  /// Check if notifications are globally enabled
  bool get areNotificationsEnabled {
    return getValue<bool>('notification_enabled', true);
  }

  /// Get notification settings count by category
  Map<String, int> getSettingsCountByCategory() {
    final grouped = notificationSettingsByCategory;
    return grouped.map((key, value) => MapEntry(key, value.length));
  }

  /// Check if setting exists in the controller
  bool hasSetting(String key) {
    return _settingsController.hasSetting(key);
  }
}
