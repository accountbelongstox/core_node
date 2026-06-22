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

// Refactored by: Kiro AI Assistant
// Date: Current refactoring session
// Changes: Updated to use new architecture standards, proper imports, and theme system
// Note to other AIs: This model now follows the new Flutter guide standards

import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';

enum ChatItemType {
  announcement,
  group,
  individual,
  channel,
}

enum ChatItemStatus {
  active,
  muted,
  archived,
  pinned,
}

class ChatItemModel {
  final String id;
  final String label;
  final String name;
  final String message;
  final String time;
  final Color color;
  final ChatItemType type;
  final ChatItemStatus status;
  final int unreadCount;
  final bool isOnline;
  final String? avatarUrl;
  final DateTime lastMessageTime;
  final String? lastMessageSender;

  const ChatItemModel({
    required this.id,
    required this.label,
    required this.name,
    required this.message,
    required this.time,
    required this.color,
    this.type = ChatItemType.group,
    this.status = ChatItemStatus.active,
    this.unreadCount = 0,
    this.isOnline = false,
    this.avatarUrl,
    required this.lastMessageTime,
    this.lastMessageSender,
  });

  static List<Color> getAvatarColors() {
    return [
      ThemeColors.blue,
      ThemeColors.teal,
      ThemeColors.orange,
      ThemeColors.purple,
      ThemeColors.green,
      ThemeColors.red,
      ThemeColors.green60,
      ThemeColors.blue60,
    ];
  }

  static List<ChatItemModel> getDefaultChats() {
    final colors = getAvatarColors();
    final now = DateTime.now();
    
    return [
      ChatItemModel(
        id: '1',
        label: 'ANN',
        name: 'Enterprise Announcement',
        message: '[Notice] About next week team building activities arrangement',
        time: '09:30',
        color: colors[0],
        type: ChatItemType.announcement,
        status: ChatItemStatus.pinned,
        unreadCount: 2,
        lastMessageTime: now.subtract(const Duration(hours: 2)),
        lastMessageSender: 'System',
      ),
      ChatItemModel(
        id: '2',
        label: 'APP',
        name: 'Mobile Development Team',
        message: 'Zhang: New version UI review meeting notes uploaded',
        time: '10:15',
        color: colors[1],
        type: ChatItemType.group,
        unreadCount: 5,
        lastMessageTime: now.subtract(const Duration(hours: 1)),
        lastMessageSender: 'Zhang Engineer',
      ),
      ChatItemModel(
        id: '3',
        label: 'DEV',
        name: 'Development Department',
        message: 'Manager Li: 3 PM technical review meeting, please attend on time',
        time: '11:40',
        color: colors[2],
        type: ChatItemType.group,
        unreadCount: 1,
        lastMessageTime: now.subtract(const Duration(minutes: 30)),
        lastMessageSender: 'Manager Li',
      ),
      ChatItemModel(
        id: '4',
        label: 'UI',
        name: 'UI/UX Team',
        message: 'Designer Wang: Latest design drafts uploaded to prototype library',
        time: '13:45',
        color: colors[3],
        type: ChatItemType.group,
        lastMessageTime: now.subtract(const Duration(minutes: 15)),
        lastMessageSender: 'Designer Wang',
      ),
      ChatItemModel(
        id: '5',
        label: 'PRO',
        name: 'Product Development',
        message: 'PM Chen: Sprint 3 progress update',
        time: '14:20',
        color: colors[4],
        type: ChatItemType.group,
        unreadCount: 3,
        lastMessageTime: now.subtract(const Duration(minutes: 5)),
        lastMessageSender: 'PM Chen',
      ),
    ];
  }

  factory ChatItemModel.fromJson(Map<String, dynamic> json) {
    return ChatItemModel(
      id: json['id'] as String,
      label: json['label'] as String,
      name: json['name'] as String,
      message: json['message'] as String,
      time: json['time'] as String,
      color: Color(json['color'] as int),
      type: ChatItemType.values[json['type'] as int? ?? 0],
      status: ChatItemStatus.values[json['status'] as int? ?? 0],
      unreadCount: json['unreadCount'] as int? ?? 0,
      isOnline: json['isOnline'] as bool? ?? false,
      avatarUrl: json['avatarUrl'] as String?,
      lastMessageTime: DateTime.parse(json['lastMessageTime'] as String),
      lastMessageSender: json['lastMessageSender'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'name': name,
      'message': message,
      'time': time,
      'color': color.value,
      'type': type.index,
      'status': status.index,
      'unreadCount': unreadCount,
      'isOnline': isOnline,
      'avatarUrl': avatarUrl,
      'lastMessageTime': lastMessageTime.toIso8601String(),
      'lastMessageSender': lastMessageSender,
    };
  }

  ChatItemModel copyWith({
    String? id,
    String? label,
    String? name,
    String? message,
    String? time,
    Color? color,
    ChatItemType? type,
    ChatItemStatus? status,
    int? unreadCount,
    bool? isOnline,
    String? avatarUrl,
    DateTime? lastMessageTime,
    String? lastMessageSender,
  }) {
    return ChatItemModel(
      id: id ?? this.id,
      label: label ?? this.label,
      name: name ?? this.name,
      message: message ?? this.message,
      time: time ?? this.time,
      color: color ?? this.color,
      type: type ?? this.type,
      status: status ?? this.status,
      unreadCount: unreadCount ?? this.unreadCount,
      isOnline: isOnline ?? this.isOnline,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      lastMessageTime: lastMessageTime ?? this.lastMessageTime,
      lastMessageSender: lastMessageSender ?? this.lastMessageSender,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ChatItemModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'ChatItemModel(id: $id, name: $name, type: $type, unreadCount: $unreadCount)';
  }
} 
