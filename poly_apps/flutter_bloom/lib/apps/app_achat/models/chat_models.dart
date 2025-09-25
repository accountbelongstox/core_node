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
import 'message_models.dart';
import 'user_models.dart';

/// AChat Conversation model
class AChatConversation {
  final String id;
  final String type;
  final String name;
  final String? avatarUrl;
  final String? description;
  final int participantsCount;
  final AChatMessage? lastMessage;
  final int unreadCount;
  final bool isPinned;
  final bool isMuted;
  final bool isArchived;
  final DateTime updatedAt;
  final String? lastReadMessageId;
  final List<AChatParticipant> participants;
  final List<String> typingUsers;
  final AChatPermissions permissions;

  AChatConversation({
    required this.id,
    required this.type,
    required this.name,
    this.avatarUrl,
    this.description,
    required this.participantsCount,
    this.lastMessage,
    required this.unreadCount,
    required this.isPinned,
    required this.isMuted,
    required this.isArchived,
    required this.updatedAt,
    this.lastReadMessageId,
    required this.participants,
    required this.typingUsers,
    required this.permissions,
  });

  factory AChatConversation.fromJson(Map<String, dynamic> json) {
    return AChatConversation(
      id: json['id'] as String,
      type: json['type'] as String,
      name: json['name'] as String,
      avatarUrl: json['avatar_url'] as String?,
      description: json['description'] as String?,
      participantsCount: json['participants_count'] as int,
      lastMessage: json['last_message'] != null
          ? AChatMessage.fromJson(json['last_message'] as Map<String, dynamic>)
          : null,
      unreadCount: json['unread_count'] as int? ?? 0,
      isPinned: json['is_pinned'] as bool? ?? false,
      isMuted: json['is_muted'] as bool? ?? false,
      isArchived: json['is_archived'] as bool? ?? false,
      updatedAt: DateTime.parse(json['updated_at'] as String),
      lastReadMessageId: json['last_read_message_id'] as String?,
      participants: (json['participants'] as List? ?? [])
          .map((item) => AChatParticipant.fromJson(item as Map<String, dynamic>))
          .toList(),
      typingUsers: List<String>.from(json['typing_users'] as List? ?? []),
      permissions: AChatPermissions.fromJson(json['permissions'] as Map<String, dynamic>? ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'name': name,
      'avatar_url': avatarUrl,
      'description': description,
      'participants_count': participantsCount,
      'last_message': lastMessage?.toJson(),
      'unread_count': unreadCount,
      'is_pinned': isPinned,
      'is_muted': isMuted,
      'is_archived': isArchived,
      'updated_at': updatedAt.toIso8601String(),
      'last_read_message_id': lastReadMessageId,
      'participants': participants.map((p) => p.toJson()).toList(),
      'typing_users': typingUsers,
      'permissions': permissions.toJson(),
    };
  }

  AChatConversation copyWith({
    String? id,
    String? type,
    String? name,
    String? avatarUrl,
    String? description,
    int? participantsCount,
    AChatMessage? lastMessage,
    int? unreadCount,
    bool? isPinned,
    bool? isMuted,
    bool? isArchived,
    DateTime? updatedAt,
    String? lastReadMessageId,
    List<AChatParticipant>? participants,
    List<String>? typingUsers,
    AChatPermissions? permissions,
  }) {
    return AChatConversation(
      id: id ?? this.id,
      type: type ?? this.type,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      description: description ?? this.description,
      participantsCount: participantsCount ?? this.participantsCount,
      lastMessage: lastMessage ?? this.lastMessage,
      unreadCount: unreadCount ?? this.unreadCount,
      isPinned: isPinned ?? this.isPinned,
      isMuted: isMuted ?? this.isMuted,
      isArchived: isArchived ?? this.isArchived,
      updatedAt: updatedAt ?? this.updatedAt,
      lastReadMessageId: lastReadMessageId ?? this.lastReadMessageId,
      participants: participants ?? this.participants,
      typingUsers: typingUsers ?? this.typingUsers,
      permissions: permissions ?? this.permissions,
    );
  }

  /// Check if conversation is individual (1:1)
  bool get isIndividual => type == 'individual';

  /// Check if conversation is group
  bool get isGroup => type == 'group';

  /// Check if conversation has unread messages
  bool get hasUnreadMessages => unreadCount > 0;

  /// Check if someone is typing
  bool get hasSomeoneTyping => typingUsers.isNotEmpty;

  /// Get other participant in individual chat
  AChatParticipant? getOtherParticipant(String currentUserId) {
    if (!isIndividual) return null;
    return participants.firstWhere(
      (p) => p.id != currentUserId,
      orElse: () => participants.first,
    );
  }

  /// Get display name for conversation
  String getDisplayName(String currentUserId) {
    if (isGroup) return name;
    final other = getOtherParticipant(currentUserId);
    return other?.name ?? name;
  }

  /// Get display avatar for conversation
  String? getDisplayAvatar(String currentUserId) {
    if (isGroup) return avatarUrl;
    final other = getOtherParticipant(currentUserId);
    return other?.avatarUrl ?? avatarUrl;
  }

  /// Get online participants count
  int get onlineParticipantsCount {
    return participants.where((p) => p.isOnline).length;
  }

  /// Check if user can send messages
  bool get canSendMessages => permissions.canSendMessages;

  /// Check if user can add participants
  bool get canAddParticipants => permissions.canAddParticipants;

  /// Check if user can leave conversation
  bool get canLeave => permissions.canLeave;
}

/// Conversation participant
class AChatParticipant {
  final String id;
  final String name;
  final String? avatarUrl;
  final bool isOnline;
  final DateTime? lastSeen;
  final AChatUserPresence presence;
  final String? role;
  final DateTime? joinedAt;

  AChatParticipant({
    required this.id,
    required this.name,
    this.avatarUrl,
    required this.isOnline,
    this.lastSeen,
    required this.presence,
    this.role,
    this.joinedAt,
  });

  factory AChatParticipant.fromJson(Map<String, dynamic> json) {
    return AChatParticipant(
      id: json['id'] as String,
      name: json['name'] as String,
      avatarUrl: json['avatar_url'] as String?,
      isOnline: json['is_online'] as bool? ?? false,
      lastSeen: json['last_seen'] != null
          ? DateTime.parse(json['last_seen'] as String)
          : null,
      presence: AChatUserPresence.fromJson(json['presence'] as Map<String, dynamic>? ?? {}),
      role: json['role'] as String?,
      joinedAt: json['joined_at'] != null
          ? DateTime.parse(json['joined_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'avatar_url': avatarUrl,
      'is_online': isOnline,
      'last_seen': lastSeen?.toIso8601String(),
      'presence': presence.toJson(),
      'role': role,
      'joined_at': joinedAt?.toIso8601String(),
    };
  }

  /// Check if participant is admin
  bool get isAdmin => role == 'admin';

  /// Check if participant is moderator
  bool get isModerator => role == 'moderator';

  /// Get formatted last seen
  String get formattedLastSeen {
    if (isOnline) return 'Online';
    if (lastSeen == null) return 'Never';

    final now = DateTime.now();
    final difference = now.difference(lastSeen!);

    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inHours < 1) return '${difference.inMinutes} minutes ago';
    if (difference.inDays < 1) return '${difference.inHours} hours ago';
    if (difference.inDays < 7) return '${difference.inDays} days ago';

    return lastSeen!.toLocal().toString().split(' ')[0];
  }
}

/// Conversation permissions
class AChatPermissions {
  final bool canSendMessages;
  final bool canAddParticipants;
  final bool canLeave;
  final bool canDeleteMessages;
  final bool canEditGroup;

  AChatPermissions({
    required this.canSendMessages,
    required this.canAddParticipants,
    required this.canLeave,
    required this.canDeleteMessages,
    required this.canEditGroup,
  });

  factory AChatPermissions.fromJson(Map<String, dynamic> json) {
    return AChatPermissions(
      canSendMessages: json['can_send_messages'] as bool? ?? true,
      canAddParticipants: json['can_add_participants'] as bool? ?? false,
      canLeave: json['can_leave'] as bool? ?? true,
      canDeleteMessages: json['can_delete_messages'] as bool? ?? false,
      canEditGroup: json['can_edit_group'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'can_send_messages': canSendMessages,
      'can_add_participants': canAddParticipants,
      'can_leave': canLeave,
      'can_delete_messages': canDeleteMessages,
      'can_edit_group': canEditGroup,
    };
  }
}

/// Search results model
class AChatSearchResults {
  final String query;
  final int totalResults;
  final int searchTimeMs;
  final AChatSearchResultData results;
  final List<String> suggestions;
  final AChatSearchFilters filtersApplied;

  AChatSearchResults({
    required this.query,
    required this.totalResults,
    required this.searchTimeMs,
    required this.results,
    required this.suggestions,
    required this.filtersApplied,
  });

  factory AChatSearchResults.fromJson(Map<String, dynamic> json) {
    return AChatSearchResults(
      query: json['query'] as String,
      totalResults: json['total_results'] as int,
      searchTimeMs: json['search_time_ms'] as int,
      results: AChatSearchResultData.fromJson(json['results'] as Map<String, dynamic>),
      suggestions: List<String>.from(json['suggestions'] as List? ?? []),
      filtersApplied: AChatSearchFilters.fromJson(json['filters_applied'] as Map<String, dynamic>? ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'query': query,
      'total_results': totalResults,
      'search_time_ms': searchTimeMs,
      'results': results.toJson(),
      'suggestions': suggestions,
      'filters_applied': filtersApplied.toJson(),
    };
  }

  /// Check if there are any results
  bool get hasResults => totalResults > 0;

  /// Check if there are message results
  bool get hasMessageResults => results.messages.isNotEmpty;

  /// Check if there are contact results
  bool get hasContactResults => results.contacts.isNotEmpty;

  /// Check if there are group results
  bool get hasGroupResults => results.groups.isNotEmpty;

  /// Check if there are file results
  bool get hasFileResults => results.files.isNotEmpty;
}

/// Search result data
class AChatSearchResultData {
  final List<AChatSearchMessage> messages;
  final List<AChatSearchContact> contacts;
  final List<AChatSearchGroup> groups;
  final List<AChatSearchFile> files;

  AChatSearchResultData({
    required this.messages,
    required this.contacts,
    required this.groups,
    required this.files,
  });

  factory AChatSearchResultData.fromJson(Map<String, dynamic> json) {
    return AChatSearchResultData(
      messages: (json['messages'] as List? ?? [])
          .map((item) => AChatSearchMessage.fromJson(item as Map<String, dynamic>))
          .toList(),
      contacts: (json['contacts'] as List? ?? [])
          .map((item) => AChatSearchContact.fromJson(item as Map<String, dynamic>))
          .toList(),
      groups: (json['groups'] as List? ?? [])
          .map((item) => AChatSearchGroup.fromJson(item as Map<String, dynamic>))
          .toList(),
      files: (json['files'] as List? ?? [])
          .map((item) => AChatSearchFile.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'messages': messages.map((item) => item.toJson()).toList(),
      'contacts': contacts.map((item) => item.toJson()).toList(),
      'groups': groups.map((item) => item.toJson()).toList(),
      'files': files.map((item) => item.toJson()).toList(),
    };
  }
}

/// Search message result
class AChatSearchMessage {
  final String id;
  final String content;
  final String contentHighlighted;
  final AChatSearchChat chat;
  final AChatMessageSender sender;
  final DateTime timestamp;
  final AChatSearchMessageContext? messageContext;
  final double relevanceScore;

  AChatSearchMessage({
    required this.id,
    required this.content,
    required this.contentHighlighted,
    required this.chat,
    required this.sender,
    required this.timestamp,
    this.messageContext,
    required this.relevanceScore,
  });

  factory AChatSearchMessage.fromJson(Map<String, dynamic> json) {
    return AChatSearchMessage(
      id: json['id'] as String,
      content: json['content'] as String,
      contentHighlighted: json['content_highlighted'] as String,
      chat: AChatSearchChat.fromJson(json['chat'] as Map<String, dynamic>),
      sender: AChatMessageSender.fromJson(json['sender'] as Map<String, dynamic>),
      timestamp: DateTime.parse(json['timestamp'] as String),
      messageContext: json['message_context'] != null
          ? AChatSearchMessageContext.fromJson(json['message_context'] as Map<String, dynamic>)
          : null,
      relevanceScore: (json['relevance_score'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'content': content,
      'content_highlighted': contentHighlighted,
      'chat': chat.toJson(),
      'sender': sender.toJson(),
      'timestamp': timestamp.toIso8601String(),
      'message_context': messageContext?.toJson(),
      'relevance_score': relevanceScore,
    };
  }
}

/// Search chat info
class AChatSearchChat {
  final String id;
  final String name;
  final String type;

  AChatSearchChat({
    required this.id,
    required this.name,
    required this.type,
  });

  factory AChatSearchChat.fromJson(Map<String, dynamic> json) {
    return AChatSearchChat(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
    };
  }
}

/// Search message context
class AChatSearchMessageContext {
  final String? previousMessage;
  final String? nextMessage;

  AChatSearchMessageContext({
    this.previousMessage,
    this.nextMessage,
  });

  factory AChatSearchMessageContext.fromJson(Map<String, dynamic> json) {
    return AChatSearchMessageContext(
      previousMessage: json['previous_message'] as String?,
      nextMessage: json['next_message'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'previous_message': previousMessage,
      'next_message': nextMessage,
    };
  }
}

/// Search contact result
class AChatSearchContact {
  final String id;
  final String name;
  final String nameHighlighted;
  final String? department;
  final String? position;
  final String? avatarUrl;
  final bool isOnline;
  final double relevanceScore;

  AChatSearchContact({
    required this.id,
    required this.name,
    required this.nameHighlighted,
    this.department,
    this.position,
    this.avatarUrl,
    required this.isOnline,
    required this.relevanceScore,
  });

  factory AChatSearchContact.fromJson(Map<String, dynamic> json) {
    return AChatSearchContact(
      id: json['id'] as String,
      name: json['name'] as String,
      nameHighlighted: json['name_highlighted'] as String,
      department: json['department'] as String?,
      position: json['position'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      isOnline: json['is_online'] as bool? ?? false,
      relevanceScore: (json['relevance_score'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'name_highlighted': nameHighlighted,
      'department': department,
      'position': position,
      'avatar_url': avatarUrl,
      'is_online': isOnline,
      'relevance_score': relevanceScore,
    };
  }
}

/// Search group result
class AChatSearchGroup {
  final String id;
  final String name;
  final String nameHighlighted;
  final String? description;
  final int participantsCount;
  final String? avatarUrl;
  final DateTime lastActivity;
  final double relevanceScore;

  AChatSearchGroup({
    required this.id,
    required this.name,
    required this.nameHighlighted,
    this.description,
    required this.participantsCount,
    this.avatarUrl,
    required this.lastActivity,
    required this.relevanceScore,
  });

  factory AChatSearchGroup.fromJson(Map<String, dynamic> json) {
    return AChatSearchGroup(
      id: json['id'] as String,
      name: json['name'] as String,
      nameHighlighted: json['name_highlighted'] as String,
      description: json['description'] as String?,
      participantsCount: json['participants_count'] as int,
      avatarUrl: json['avatar_url'] as String?,
      lastActivity: DateTime.parse(json['last_activity'] as String),
      relevanceScore: (json['relevance_score'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'name_highlighted': nameHighlighted,
      'description': description,
      'participants_count': participantsCount,
      'avatar_url': avatarUrl,
      'last_activity': lastActivity.toIso8601String(),
      'relevance_score': relevanceScore,
    };
  }
}

/// Search file result
class AChatSearchFile {
  final String id;
  final String filename;
  final String filenameHighlighted;
  final String type;
  final int size;
  final AChatMessageSender uploadedBy;
  final DateTime uploadedAt;
  final String? chatId;
  final double relevanceScore;

  AChatSearchFile({
    required this.id,
    required this.filename,
    required this.filenameHighlighted,
    required this.type,
    required this.size,
    required this.uploadedBy,
    required this.uploadedAt,
    this.chatId,
    required this.relevanceScore,
  });

  factory AChatSearchFile.fromJson(Map<String, dynamic> json) {
    return AChatSearchFile(
      id: json['id'] as String,
      filename: json['filename'] as String,
      filenameHighlighted: json['filename_highlighted'] as String,
      type: json['type'] as String,
      size: json['size'] as int,
      uploadedBy: AChatMessageSender.fromJson(json['uploaded_by'] as Map<String, dynamic>),
      uploadedAt: DateTime.parse(json['uploaded_at'] as String),
      chatId: json['chat_id'] as String?,
      relevanceScore: (json['relevance_score'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'filename': filename,
      'filename_highlighted': filenameHighlighted,
      'type': type,
      'size': size,
      'uploaded_by': uploadedBy.toJson(),
      'uploaded_at': uploadedAt.toIso8601String(),
      'chat_id': chatId,
      'relevance_score': relevanceScore,
    };
  }

  /// Get human-readable file size
  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    if (size < 1024 * 1024 * 1024) return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(size / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }
}

/// Search filters applied
class AChatSearchFilters {
  final String type;
  final String? dateRange;
  final String? chatId;

  AChatSearchFilters({
    required this.type,
    this.dateRange,
    this.chatId,
  });

  factory AChatSearchFilters.fromJson(Map<String, dynamic> json) {
    return AChatSearchFilters(
      type: json['type'] as String? ?? 'all',
      dateRange: json['date_range'] as String?,
      chatId: json['chat_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'date_range': dateRange,
      'chat_id': chatId,
    };
  }
}