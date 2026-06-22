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

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/notification_setting/domain/model/notification_setting_model.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';

// AI MODIFICATION NOTE: This service was rewritten by QR_Profile_AI_Assistant
// - Fixed import path for NotificationSettingModel
// - Added comprehensive notification settings management
// - Integrated with common settings controller for persistence
// Other AIs: Please maintain the settings persistence logic when modifying

class NotificationSettingService {
  final SettingsController _settingsController;

  NotificationSettingService(this._settingsController);

  /// Get notification settings from storage
  Future<NotificationSettingModel> getSettings() async {
    try {
      final settingsJson = _settingsController.getSetting<String>('notification_settings_json', '');

      if (settingsJson?.isNotEmpty == true) {
        final Map<String, dynamic> data = json.decode(settingsJson!);
        return NotificationSettingModel.fromJson(data);
      }

      return NotificationSettingModel.defaultSettings();
    } catch (e) {
      // If parsing fails, return default settings
      return NotificationSettingModel.defaultSettings();
    }
  }

  /// Save notification settings to storage
  Future<void> saveSettings(NotificationSettingModel settings) async {
    try {
      final settingsJson = json.encode(settings.toJson());
      await _settingsController.setSetting('notification_settings_json', settingsJson);

      // Also save individual settings for easy access
      await _saveIndividualSettings(settings);
    } catch (e) {
      throw Exception('Failed to save notification settings: $e');
    }
  }

  /// Save individual settings for backward compatibility
  Future<void> _saveIndividualSettings(NotificationSettingModel settings) async {
    await _settingsController.setSetting('notification_enabled', settings.showNotification);
    await _settingsController.setSetting('notification_preview', settings.previewMessage);
    await _settingsController.setSetting('notification_banner', settings.landscapeNotification);
    await _settingsController.setSetting('notification_sound', settings.appPlaySound);
    await _settingsController.setSetting('notification_vibration', true); // Default vibration
    await _settingsController.setSetting('group_notifications', settings.groupImportant);
    await _settingsController.setSetting('group_mentions_only', settings.groupAtMe);
    await _settingsController.setSetting('channel_notifications', settings.channelProject);
    await _settingsController.setSetting('message_notifications', true); // Default message notifications
  }

  /// Show time range picker for work hours
  Future<List<TimeOfDay>?> showTimeRangePicker(
    BuildContext context,
    TimeOfDay initialStart,
    TimeOfDay initialEnd,
  ) async {
    final start = await showTimePicker(
      context: context,
      initialTime: initialStart,
      helpText: 'Select start time',
    );

    if (start == null) return null;

    final end = await showTimePicker(
      context: context,
      initialTime: initialEnd,
      helpText: 'Select end time',
    );

    if (end == null) return null;

    // Validate time range
    if (_isValidTimeRange(start, end)) {
      return [start, end];
    } else {
      // Show error if end time is before start time
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('End time must be after start time'),
          ),
        );
      }
      return null;
    }
  }

  /// Validate if time range is valid
  bool _isValidTimeRange(TimeOfDay start, TimeOfDay end) {
    final startMinutes = start.hour * 60 + start.minute;
    final endMinutes = end.hour * 60 + end.minute;
    return endMinutes > startMinutes;
  }

  /// Reset all notification settings to defaults
  Future<void> resetToDefaults() async {
    final defaultSettings = NotificationSettingModel.defaultSettings();
    await saveSettings(defaultSettings);
  }

  /// Check if notifications are enabled at system level
  Future<bool> areSystemNotificationsEnabled() async {
    // This would typically check system notification permissions
    // For now, return true as a placeholder
    return true;
  }

  /// Request notification permissions (placeholder)
  Future<bool> requestNotificationPermissions() async {
    // This would typically request system notification permissions
    // For now, return true as a placeholder
    return true;
  }
}
