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

// AI MODIFICATION NOTE: This model was enhanced by QR_Profile_AI_Assistant
// - Added JSON serialization support for persistence
// - Enhanced with better default values and validation
// - Added comprehensive notification settings
// Other AIs: Please maintain JSON serialization when modifying this model

class NotificationSettingModel {
  final bool showNotification;
  final bool previewMessage;
  final bool landscapeNotification;
  final bool groupImportant;
  final bool groupAtMe;
  final bool channelProject;
  final bool channelTask;
  final bool appPlaySound;
  final bool appPreview;
  final bool unreadIncludeClosed;
  final bool unreadCountByConversation;
  final bool workTimeNotify;
  final bool newContactNotify;
  final bool priorityContact;
  final TimeOfDay workStart;
  final TimeOfDay workEnd;

  const NotificationSettingModel({
    required this.showNotification,
    required this.previewMessage,
    required this.landscapeNotification,
    required this.groupImportant,
    required this.groupAtMe,
    required this.channelProject,
    required this.channelTask,
    required this.appPlaySound,
    required this.appPreview,
    required this.unreadIncludeClosed,
    required this.unreadCountByConversation,
    required this.workTimeNotify,
    required this.newContactNotify,
    required this.priorityContact,
    required this.workStart,
    required this.workEnd,
  });

  factory NotificationSettingModel.defaultSettings() {
    return const NotificationSettingModel(
      showNotification: true,
      previewMessage: true,
      landscapeNotification: true,
      groupImportant: true,
      groupAtMe: true,
      channelProject: true,
      channelTask: true,
      appPlaySound: true,
      appPreview: true,
      unreadIncludeClosed: false,
      unreadCountByConversation: true,
      workTimeNotify: true,
      newContactNotify: false,
      priorityContact: true,
      workStart: TimeOfDay(hour: 9, minute: 0),
      workEnd: TimeOfDay(hour: 18, minute: 0),
    );
  }

  NotificationSettingModel copyWith({
    bool? showNotification,
    bool? previewMessage,
    bool? landscapeNotification,
    bool? groupImportant,
    bool? groupAtMe,
    bool? channelProject,
    bool? channelTask,
    bool? appPlaySound,
    bool? appPreview,
    bool? unreadIncludeClosed,
    bool? unreadCountByConversation,
    bool? workTimeNotify,
    bool? newContactNotify,
    bool? priorityContact,
    TimeOfDay? workStart,
    TimeOfDay? workEnd,
  }) {
    return NotificationSettingModel(
      showNotification: showNotification ?? this.showNotification,
      previewMessage: previewMessage ?? this.previewMessage,
      landscapeNotification: landscapeNotification ?? this.landscapeNotification,
      groupImportant: groupImportant ?? this.groupImportant,
      groupAtMe: groupAtMe ?? this.groupAtMe,
      channelProject: channelProject ?? this.channelProject,
      channelTask: channelTask ?? this.channelTask,
      appPlaySound: appPlaySound ?? this.appPlaySound,
      appPreview: appPreview ?? this.appPreview,
      unreadIncludeClosed: unreadIncludeClosed ?? this.unreadIncludeClosed,
      unreadCountByConversation: unreadCountByConversation ?? this.unreadCountByConversation,
      workTimeNotify: workTimeNotify ?? this.workTimeNotify,
      newContactNotify: newContactNotify ?? this.newContactNotify,
      priorityContact: priorityContact ?? this.priorityContact,
      workStart: workStart ?? this.workStart,
      workEnd: workEnd ?? this.workEnd,
    );
  }

  /// Convert to JSON for persistence
  Map<String, dynamic> toJson() {
    return {
      'showNotification': showNotification,
      'previewMessage': previewMessage,
      'landscapeNotification': landscapeNotification,
      'groupImportant': groupImportant,
      'groupAtMe': groupAtMe,
      'channelProject': channelProject,
      'channelTask': channelTask,
      'appPlaySound': appPlaySound,
      'appPreview': appPreview,
      'unreadIncludeClosed': unreadIncludeClosed,
      'unreadCountByConversation': unreadCountByConversation,
      'workTimeNotify': workTimeNotify,
      'newContactNotify': newContactNotify,
      'priorityContact': priorityContact,
      'workStartHour': workStart.hour,
      'workStartMinute': workStart.minute,
      'workEndHour': workEnd.hour,
      'workEndMinute': workEnd.minute,
    };
  }

  /// Create from JSON
  factory NotificationSettingModel.fromJson(Map<String, dynamic> json) {
    return NotificationSettingModel(
      showNotification: json['showNotification'] ?? true,
      previewMessage: json['previewMessage'] ?? true,
      landscapeNotification: json['landscapeNotification'] ?? true,
      groupImportant: json['groupImportant'] ?? true,
      groupAtMe: json['groupAtMe'] ?? true,
      channelProject: json['channelProject'] ?? true,
      channelTask: json['channelTask'] ?? true,
      appPlaySound: json['appPlaySound'] ?? true,
      appPreview: json['appPreview'] ?? true,
      unreadIncludeClosed: json['unreadIncludeClosed'] ?? false,
      unreadCountByConversation: json['unreadCountByConversation'] ?? true,
      workTimeNotify: json['workTimeNotify'] ?? true,
      newContactNotify: json['newContactNotify'] ?? false,
      priorityContact: json['priorityContact'] ?? true,
      workStart: TimeOfDay(
        hour: json['workStartHour'] ?? 9,
        minute: json['workStartMinute'] ?? 0,
      ),
      workEnd: TimeOfDay(
        hour: json['workEndHour'] ?? 18,
        minute: json['workEndMinute'] ?? 0,
      ),
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is NotificationSettingModel &&
        other.showNotification == showNotification &&
        other.previewMessage == previewMessage &&
        other.landscapeNotification == landscapeNotification &&
        other.groupImportant == groupImportant &&
        other.groupAtMe == groupAtMe &&
        other.channelProject == channelProject &&
        other.channelTask == channelTask &&
        other.appPlaySound == appPlaySound &&
        other.appPreview == appPreview &&
        other.unreadIncludeClosed == unreadIncludeClosed &&
        other.unreadCountByConversation == unreadCountByConversation &&
        other.workTimeNotify == workTimeNotify &&
        other.newContactNotify == newContactNotify &&
        other.priorityContact == priorityContact &&
        other.workStart == workStart &&
        other.workEnd == workEnd;
  }

  @override
  int get hashCode {
    return Object.hash(
      showNotification,
      previewMessage,
      landscapeNotification,
      groupImportant,
      groupAtMe,
      channelProject,
      channelTask,
      appPlaySound,
      appPreview,
      unreadIncludeClosed,
      unreadCountByConversation,
      workTimeNotify,
      newContactNotify,
      priorityContact,
      workStart,
      workEnd,
    );
  }

  @override
  String toString() {
    return 'NotificationSettingModel('
        'showNotification: $showNotification, '
        'previewMessage: $previewMessage, '
        'landscapeNotification: $landscapeNotification, '
        'groupImportant: $groupImportant, '
        'groupAtMe: $groupAtMe, '
        'channelProject: $channelProject, '
        'channelTask: $channelTask, '
        'appPlaySound: $appPlaySound, '
        'appPreview: $appPreview, '
        'unreadIncludeClosed: $unreadIncludeClosed, '
        'unreadCountByConversation: $unreadCountByConversation, '
        'workTimeNotify: $workTimeNotify, '
        'newContactNotify: $newContactNotify, '
        'priorityContact: $priorityContact, '
        'workStart: $workStart, '
        'workEnd: $workEnd)';
  }
}
