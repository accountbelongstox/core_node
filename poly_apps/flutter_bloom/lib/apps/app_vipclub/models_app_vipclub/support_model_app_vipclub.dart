/// Support Message Model for VIP Club Customer Service
class VipClubSupportMessageModel {
  final String id;
  final String userId;
  final String message;
  final List<String> attachments;
  final bool isFromUser;
  final bool isRead;
  final DateTime createdAt;

  VipClubSupportMessageModel({
    required this.id,
    required this.userId,
    required this.message,
    this.attachments = const [],
    required this.isFromUser,
    this.isRead = false,
    required this.createdAt,
  });

  /// Create from JSON
  factory VipClubSupportMessageModel.fromJson(Map<String, dynamic> json) {
    return VipClubSupportMessageModel(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      attachments: json['attachments'] != null
          ? List<String>.from(json['attachments'])
          : [],
      isFromUser: json['is_from_user'] ?? json['isFromUser'] ?? true,
      isRead: json['is_read'] ?? json['isRead'] ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'].toString())
          : json['createdAt'] != null
              ? DateTime.parse(json['createdAt'].toString())
              : DateTime.now(),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'message': message,
      'attachments': attachments,
      'is_from_user': isFromUser,
      'is_read': isRead,
      'created_at': createdAt.toIso8601String(),
    };
  }

  /// Copy with
  VipClubSupportMessageModel copyWith({
    String? id,
    String? userId,
    String? message,
    List<String>? attachments,
    bool? isFromUser,
    bool? isRead,
    DateTime? createdAt,
  }) {
    return VipClubSupportMessageModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      message: message ?? this.message,
      attachments: attachments ?? this.attachments,
      isFromUser: isFromUser ?? this.isFromUser,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  /// Get formatted time
  String get formattedTime {
    final now = DateTime.now();
    final difference = now.difference(createdAt);

    if (difference.inDays == 0) {
      // Today - show time
      final hour = createdAt.hour.toString().padLeft(2, '0');
      final minute = createdAt.minute.toString().padLeft(2, '0');
      return '$hour:$minute';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return '${createdAt.year}-${createdAt.month.toString().padLeft(2, '0')}-${createdAt.day.toString().padLeft(2, '0')}';
    }
  }

  @override
  String toString() {
    return 'VipClubSupportMessageModel(id: $id, isFromUser: $isFromUser, message: ${message.substring(0, message.length > 30 ? 30 : message.length)}...)';
  }
}

/// Support Info Model for contact information
class VipClubSupportInfoModel {
  final String phone;
  final String email;
  final String wechat;
  final String whatsapp;
  final String hours;

  VipClubSupportInfoModel({
    required this.phone,
    required this.email,
    this.wechat = '',
    this.whatsapp = '',
    required this.hours,
  });

  factory VipClubSupportInfoModel.fromJson(Map<String, dynamic> json) {
    return VipClubSupportInfoModel(
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      wechat: json['wechat']?.toString() ?? '',
      whatsapp: json['whatsapp']?.toString() ?? '',
      hours: json['hours']?.toString() ?? '24/7',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'phone': phone,
      'email': email,
      'wechat': wechat,
      'whatsapp': whatsapp,
      'hours': hours,
    };
  }
}

/// Support conversation summary
class VipClubSupportConversationModel {
  final String userId;
  final List<VipClubSupportMessageModel> messages;
  final int unreadCount;
  final DateTime? lastMessageAt;

  VipClubSupportConversationModel({
    required this.userId,
    this.messages = const [],
    this.unreadCount = 0,
    this.lastMessageAt,
  });

  factory VipClubSupportConversationModel.fromJson(Map<String, dynamic> json) {
    return VipClubSupportConversationModel(
      userId: json['user_id']?.toString() ?? json['userId']?.toString() ?? '',
      messages: json['messages'] != null
          ? (json['messages'] as List)
              .map((m) => VipClubSupportMessageModel.fromJson(m))
              .toList()
          : [],
      unreadCount: json['unread_count'] ?? json['unreadCount'] ?? 0,
      lastMessageAt: json['last_message_at'] != null
          ? DateTime.parse(json['last_message_at'].toString())
          : json['lastMessageAt'] != null
              ? DateTime.parse(json['lastMessageAt'].toString())
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'messages': messages.map((m) => m.toJson()).toList(),
      'unread_count': unreadCount,
      if (lastMessageAt != null)
        'last_message_at': lastMessageAt!.toIso8601String(),
    };
  }

  /// Get last message
  VipClubSupportMessageModel? get lastMessage {
    if (messages.isEmpty) return null;
    return messages.last;
  }

  /// Check if has unread messages
  bool get hasUnread => unreadCount > 0;
}
