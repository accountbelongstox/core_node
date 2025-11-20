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

enum MessageType {
  text,
  image,
  audio,
  video,
  file,
  location,
  system,
}

enum MessageStatus {
  sending,
  sent,
  delivered,
  read,
  failed,
}

enum SystemMessageType {
  battery,
  appOpened,
  screenshot,
  locationChanged,
  networkChanged,
  deviceUnlock,
  appUsage,
}

class ChatMessageModelAppWuy {
  final String id;
  final String chatId;
  final String senderId;
  final String? receiverId;
  final String content;
  final String messageType;
  final bool isRead;
  final DateTime createdAt;
  final DateTime? readAt;
  final Map<String, dynamic>? metadata;
  final String? replyToId;
  final bool isEdited;
  final DateTime? editedAt;
  final bool isSystemMessage;
  final String? systemMessageType;

  const ChatMessageModelAppWuy({
    required this.id,
    required this.chatId,
    required this.senderId,
    this.receiverId,
    required this.content,
    this.messageType = 'text',
    this.isRead = false,
    required this.createdAt,
    this.readAt,
    this.metadata,
    this.replyToId,
    this.isEdited = false,
    this.editedAt,
    this.isSystemMessage = false,
    this.systemMessageType,
  });

  factory ChatMessageModelAppWuy.fromJson(Map<String, dynamic> json) {
    return ChatMessageModelAppWuy(
      id: json['id'] as String,
      chatId: json['chat_id'] as String? ?? json['chatId'] as String,
      senderId: json['sender_id'] as String? ?? json['senderId'] as String,
      receiverId: json['receiver_id'] as String? ?? json['receiverId'] as String?,
      content: json['content'] as String,
      messageType: json['message_type'] as String? ?? json['messageType'] as String? ?? 'text',
      isRead: json['is_read'] as bool? ?? json['isRead'] as bool? ?? false,
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at'] as String)
          : json['createdAt'] != null 
              ? DateTime.parse(json['createdAt'] as String)
              : DateTime.parse(json['timestamp'] as String),
      readAt: json['read_at'] != null 
          ? DateTime.parse(json['read_at'] as String)
          : json['readAt'] != null 
              ? DateTime.parse(json['readAt'] as String)
              : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
      replyToId: json['reply_to_id'] as String? ?? json['replyToId'] as String?,
      isEdited: json['is_edited'] as bool? ?? json['isEdited'] as bool? ?? false,
      editedAt: json['edited_at'] != null
          ? DateTime.parse(json['edited_at'] as String)
          : json['editedAt'] != null
              ? DateTime.parse(json['editedAt'] as String)
              : null,
      isSystemMessage: json['is_system_message'] as bool? ?? json['isSystemMessage'] as bool? ?? false,
      systemMessageType: json['system_message_type'] as String? ?? json['systemMessageType'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'chat_id': chatId,
      'sender_id': senderId,
      'receiver_id': receiverId,
      'content': content,
      'message_type': messageType,
      'is_read': isRead,
      'created_at': createdAt.toIso8601String(),
      'read_at': readAt?.toIso8601String(),
      'metadata': metadata,
      'reply_to_id': replyToId,
      'is_edited': isEdited,
      'edited_at': editedAt?.toIso8601String(),
      'is_system_message': isSystemMessage,
      'system_message_type': systemMessageType,
    };
  }

  ChatMessageModelAppWuy copyWith({
    String? id,
    String? chatId,
    String? senderId,
    String? receiverId,
    String? content,
    String? messageType,
    bool? isRead,
    DateTime? createdAt,
    DateTime? readAt,
    Map<String, dynamic>? metadata,
    String? replyToId,
    bool? isEdited,
    DateTime? editedAt,
    bool? isSystemMessage,
    String? systemMessageType,
  }) {
    return ChatMessageModelAppWuy(
      id: id ?? this.id,
      chatId: chatId ?? this.chatId,
      senderId: senderId ?? this.senderId,
      receiverId: receiverId ?? this.receiverId,
      content: content ?? this.content,
      messageType: messageType ?? this.messageType,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      readAt: readAt ?? this.readAt,
      metadata: metadata ?? this.metadata,
      replyToId: replyToId ?? this.replyToId,
      isEdited: isEdited ?? this.isEdited,
      editedAt: editedAt ?? this.editedAt,
      isSystemMessage: isSystemMessage ?? this.isSystemMessage,
      systemMessageType: systemMessageType ?? this.systemMessageType,
    );
  }

  bool get isFromCurrentUser => senderId == 'current_user'; // This should be dynamic

  String get timeText {
    final now = DateTime.now();
    final difference = now.difference(createdAt);
    
    if (difference.inDays > 0) {
      return '${createdAt.day}/${createdAt.month}';
    } else if (difference.inHours > 0) {
      return '${createdAt.hour.toString().padLeft(2, '0')}:${createdAt.minute.toString().padLeft(2, '0')}';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  String get statusText {
    if (isRead) {
      return 'Read';
    } else {
      return 'Sent';
    }
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ChatMessageModelAppWuy && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'ChatMessageModelAppWuy(id: $id, content: $content, messageType: $messageType, isRead: $isRead)';
  }
}
