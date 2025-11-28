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

/// Settings model for QY App
library;

import '../../../../localization_app_qy/localization_keys_app_qy.dart';

class AppSettingsModel {
  final bool notificationsEnabled;
  final bool soundEnabled;
  final bool vibrationEnabled;
  final bool autoPlayAudio;
  final bool showTranslation;
  final String language;
  final String theme;
  final int dailyGoal;
  final int reminderHour;
  final int reminderMinute;
  final bool weekendReminder;
  final Map<String, dynamic>? additionalSettings;

  const AppSettingsModel({
    this.notificationsEnabled = true,
    this.soundEnabled = true,
    this.vibrationEnabled = true,
    this.autoPlayAudio = true,
    this.showTranslation = true,
    this.language = QyAppLocalizationKeys.qyLanguageCodeZh,
    this.theme = 'auto',
    this.dailyGoal = 200,
    this.reminderHour = 9,
    this.reminderMinute = 0,
    this.weekendReminder = false,
    this.additionalSettings,
  });

  factory AppSettingsModel.fromJson(Map<String, dynamic> json) {
    return AppSettingsModel(
      notificationsEnabled: json['notifications_enabled'] as bool? ?? true,
      soundEnabled: json['sound_enabled'] as bool? ?? true,
      vibrationEnabled: json['vibration_enabled'] as bool? ?? true,
      autoPlayAudio: json['auto_play_audio'] as bool? ?? true,
      showTranslation: json['show_translation'] as bool? ?? true,
      language: json['language'] as String? ?? QyAppLocalizationKeys.qyLanguageCodeZh,
      theme: json['theme'] as String? ?? 'auto',
      dailyGoal: json['daily_goal'] as int? ?? 200,
      reminderHour: json['reminder_hour'] as int? ?? 9,
      reminderMinute: json['reminder_minute'] as int? ?? 0,
      weekendReminder: json['weekend_reminder'] as bool? ?? false,
      additionalSettings: json['additional_settings'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'notifications_enabled': notificationsEnabled,
      'sound_enabled': soundEnabled,
      'vibration_enabled': vibrationEnabled,
      'auto_play_audio': autoPlayAudio,
      'show_translation': showTranslation,
      'language': language,
      'theme': theme,
      'daily_goal': dailyGoal,
      'reminder_hour': reminderHour,
      'reminder_minute': reminderMinute,
      'weekend_reminder': weekendReminder,
      'additional_settings': additionalSettings,
    };
  }

  AppSettingsModel copyWith({
    bool? notificationsEnabled,
    bool? soundEnabled,
    bool? vibrationEnabled,
    bool? autoPlayAudio,
    bool? showTranslation,
    String? language,
    String? theme,
    int? dailyGoal,
    int? reminderHour,
    int? reminderMinute,
    bool? weekendReminder,
    Map<String, dynamic>? additionalSettings,
  }) {
    return AppSettingsModel(
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      soundEnabled: soundEnabled ?? this.soundEnabled,
      vibrationEnabled: vibrationEnabled ?? this.vibrationEnabled,
      autoPlayAudio: autoPlayAudio ?? this.autoPlayAudio,
      showTranslation: showTranslation ?? this.showTranslation,
      language: language ?? this.language,
      theme: theme ?? this.theme,
      dailyGoal: dailyGoal ?? this.dailyGoal,
      reminderHour: reminderHour ?? this.reminderHour,
      reminderMinute: reminderMinute ?? this.reminderMinute,
      weekendReminder: weekendReminder ?? this.weekendReminder,
      additionalSettings: additionalSettings ?? this.additionalSettings,
    );
  }

  static AppSettingsModel defaultSettings() {
    return const AppSettingsModel();
  }
}
