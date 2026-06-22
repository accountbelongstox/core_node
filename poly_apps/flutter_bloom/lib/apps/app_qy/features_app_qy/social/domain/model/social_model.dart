// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

library;

class MessageModel {
  final String id;
  final String senderId;
  final String senderName;
  final String? senderAvatar;
  final String content;
  final String type;
  final bool isRead;
  final DateTime createdAt;
  final Map<String, dynamic>? metadata;

  const MessageModel({
    required this.id,
    required this.senderId,
    required this.senderName,
    this.senderAvatar,
    required this.content,
    required this.type,
    required this.isRead,
    required this.createdAt,
    this.metadata,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'] as String,
      senderId: json['sender_id'] as String,
      senderName: json['sender_name'] as String,
      senderAvatar: json['sender_avatar'] as String?,
      content: json['content'] as String,
      type: json['type'] as String,
      isRead: json['is_read'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sender_id': senderId,
      'sender_name': senderName,
      'sender_avatar': senderAvatar,
      'content': content,
      'type': type,
      'is_read': isRead,
      'created_at': createdAt.toIso8601String(),
      'metadata': metadata,
    };
  }

  MessageModel copyWith({
    String? id,
    String? senderId,
    String? senderName,
    String? senderAvatar,
    String? content,
    String? type,
    bool? isRead,
    DateTime? createdAt,
    Map<String, dynamic>? metadata,
  }) {
    return MessageModel(
      id: id ?? this.id,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
      content: content ?? this.content,
      type: type ?? this.type,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      metadata: metadata ?? this.metadata,
    );
  }
}

class CheckInModel {
  final String id;
  final String userId;
  final DateTime checkInDate;
  final int consecutiveDays;
  final int totalDays;
  final int wordsLearnedToday;
  final int studyMinutesToday;
  final bool hasBonus;
  final int bonusPoints;

  const CheckInModel({
    required this.id,
    required this.userId,
    required this.checkInDate,
    required this.consecutiveDays,
    required this.totalDays,
    required this.wordsLearnedToday,
    required this.studyMinutesToday,
    required this.hasBonus,
    required this.bonusPoints,
  });

  factory CheckInModel.fromJson(Map<String, dynamic> json) {
    return CheckInModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      checkInDate: DateTime.parse(json['check_in_date'] as String),
      consecutiveDays: json['consecutive_days'] as int? ?? 0,
      totalDays: json['total_days'] as int? ?? 0,
      wordsLearnedToday: json['words_learned_today'] as int? ?? 0,
      studyMinutesToday: json['study_minutes_today'] as int? ?? 0,
      hasBonus: json['has_bonus'] as bool? ?? false,
      bonusPoints: json['bonus_points'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'check_in_date': checkInDate.toIso8601String(),
      'consecutive_days': consecutiveDays,
      'total_days': totalDays,
      'words_learned_today': wordsLearnedToday,
      'study_minutes_today': studyMinutesToday,
      'has_bonus': hasBonus,
      'bonus_points': bonusPoints,
    };
  }
}

class CheckInChallengeModel {
  final String id;
  final String title;
  final String description;
  final int targetDays;
  final int currentDays;
  final DateTime startDate;
  final DateTime endDate;
  final int rewardPoints;
  final String status;
  final int participants;

  const CheckInChallengeModel({
    required this.id,
    required this.title,
    required this.description,
    required this.targetDays,
    required this.currentDays,
    required this.startDate,
    required this.endDate,
    required this.rewardPoints,
    required this.status,
    required this.participants,
  });

  factory CheckInChallengeModel.fromJson(Map<String, dynamic> json) {
    return CheckInChallengeModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      targetDays: json['target_days'] as int,
      currentDays: json['current_days'] as int? ?? 0,
      startDate: DateTime.parse(json['start_date'] as String),
      endDate: DateTime.parse(json['end_date'] as String),
      rewardPoints: json['reward_points'] as int? ?? 0,
      status: json['status'] as String,
      participants: json['participants'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'target_days': targetDays,
      'current_days': currentDays,
      'start_date': startDate.toIso8601String(),
      'end_date': endDate.toIso8601String(),
      'reward_points': rewardPoints,
      'status': status,
      'participants': participants,
    };
  }

  double get progress => targetDays > 0 ? (currentDays / targetDays) : 0.0;
  bool get isCompleted => currentDays >= targetDays;
  bool get isActive => status == 'active';
}

class NotificationModel {
  final String id;
  final String title;
  final String content;
  final String type;
  final bool isRead;
  final DateTime createdAt;
  final String? actionUrl;

  const NotificationModel({
    required this.id,
    required this.title,
    required this.content,
    required this.type,
    required this.isRead,
    required this.createdAt,
    this.actionUrl,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as String,
      title: json['title'] as String,
      content: json['content'] as String,
      type: json['type'] as String,
      isRead: json['is_read'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      actionUrl: json['action_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'type': type,
      'is_read': isRead,
      'created_at': createdAt.toIso8601String(),
      'action_url': actionUrl,
    };
  }
}
