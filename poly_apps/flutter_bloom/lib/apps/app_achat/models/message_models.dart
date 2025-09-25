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
import 'user_models.dart';

/// AChat Message model
class AChatMessage {
  final String id;
  final String chatId;
  final AChatMessageSender sender;
  final String content;
  final bool contentEncrypted;
  final String type;
  final DateTime timestamp;
  final DateTime? editedAt;
  final String? replyToMessageId;
  final List<AChatAttachment> attachments;
  final List<AChatReaction> reactions;
  final List<AChatReadStatus> readBy;
  final String deliveryStatus;
  final bool isSystemMessage;
  final AChatMessageMetadata metadata;

  AChatMessage({
    required this.id,
    required this.chatId,
    required this.sender,
    required this.content,
    required this.contentEncrypted,
    required this.type,
    required this.timestamp,
    this.editedAt,
    this.replyToMessageId,
    required this.attachments,
    required this.reactions,
    required this.readBy,
    required this.deliveryStatus,
    required this.isSystemMessage,
    required this.metadata,
  });

  factory AChatMessage.fromJson(Map<String, dynamic> json) {
    return AChatMessage(
      id: json['id'] as String,
      chatId: json['chat_id'] as String,
      sender: AChatMessageSender.fromJson(json['sender'] as Map<String, dynamic>),
      content: json['content'] as String,
      contentEncrypted: json['content_encrypted'] as bool? ?? false,
      type: json['type'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      editedAt: json['edited_at'] != null
          ? DateTime.parse(json['edited_at'] as String)
          : null,
      replyToMessageId: json['reply_to'] as String?,
      attachments: (json['attachments'] as List? ?? [])
          .map((item) => AChatAttachment.fromJson(item as Map<String, dynamic>))
          .toList(),
      reactions: (json['reactions'] as List? ?? [])
          .map((item) => AChatReaction.fromJson(item as Map<String, dynamic>))
          .toList(),
      readBy: (json['read_by'] as List? ?? [])
          .map((item) => AChatReadStatus.fromJson(item as Map<String, dynamic>))
          .toList(),
      deliveryStatus: json['delivery_status'] as String? ?? 'sent',
      isSystemMessage: json['is_system_message'] as bool? ?? false,
      metadata: AChatMessageMetadata.fromJson(json['metadata'] as Map<String, dynamic>? ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'chat_id': chatId,
      'sender': sender.toJson(),
      'content': content,
      'content_encrypted': contentEncrypted,
      'type': type,
      'timestamp': timestamp.toIso8601String(),
      'edited_at': editedAt?.toIso8601String(),
      'reply_to': replyToMessageId,
      'attachments': attachments.map((item) => item.toJson()).toList(),
      'reactions': reactions.map((item) => item.toJson()).toList(),
      'read_by': readBy.map((item) => item.toJson()).toList(),
      'delivery_status': deliveryStatus,
      'is_system_message': isSystemMessage,
      'metadata': metadata.toJson(),
    };
  }

  AChatMessage copyWith({
    String? id,
    String? chatId,
    AChatMessageSender? sender,
    String? content,
    bool? contentEncrypted,
    String? type,
    DateTime? timestamp,
    DateTime? editedAt,
    String? replyToMessageId,
    List<AChatAttachment>? attachments,
    List<AChatReaction>? reactions,
    List<AChatReadStatus>? readBy,
    String? deliveryStatus,
    bool? isSystemMessage,
    AChatMessageMetadata? metadata,
  }) {
    return AChatMessage(
      id: id ?? this.id,
      chatId: chatId ?? this.chatId,
      sender: sender ?? this.sender,
      content: content ?? this.content,
      contentEncrypted: contentEncrypted ?? this.contentEncrypted,
      type: type ?? this.type,
      timestamp: timestamp ?? this.timestamp,
      editedAt: editedAt ?? this.editedAt,
      replyToMessageId: replyToMessageId ?? this.replyToMessageId,
      attachments: attachments ?? this.attachments,
      reactions: reactions ?? this.reactions,
      readBy: readBy ?? this.readBy,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
      isSystemMessage: isSystemMessage ?? this.isSystemMessage,
      metadata: metadata ?? this.metadata,
    );
  }

  /// Check if message is from current user
  bool isFromUser(String userId) => sender.id == userId;

  /// Check if message is read by user
  bool isReadBy(String userId) => readBy.any((status) => status.userId == userId);

  /// Check if message has reactions
  bool get hasReactions => reactions.isNotEmpty;

  /// Check if message has attachments
  bool get hasAttachments => attachments.isNotEmpty;

  /// Check if message is edited
  bool get isEdited => editedAt != null;

  /// Get reaction count for emoji
  int getReactionCount(String emoji) {
    return reactions
        .where((reaction) => reaction.emoji == emoji)
        .fold(0, (sum, reaction) => sum + reaction.count);
  }

  /// Check if user reacted with emoji
  bool hasUserReaction(String userId, String emoji) {
    return reactions
        .where((reaction) => reaction.emoji == emoji)
        .any((reaction) => reaction.users.any((user) => user.id == userId));
  }
}

/// Message sender information
class AChatMessageSender {
  final String id;
  final String name;
  final String? avatarUrl;

  AChatMessageSender({
    required this.id,
    required this.name,
    this.avatarUrl,
  });

  factory AChatMessageSender.fromJson(Map<String, dynamic> json) {
    return AChatMessageSender(
      id: json['id'] as String,
      name: json['name'] as String,
      avatarUrl: json['avatar_url'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'avatar_url': avatarUrl,
    };
  }
}

/// Message attachment
class AChatAttachment {
  final String id;
  final String type;
  final String url;
  final String? thumbnailUrl;
  final String filename;
  final String originalFilename;
  final int size;
  final int? width;
  final int? height;
  final String mimeType;
  final String? downloadUrl;
  final DateTime? expiresAt;
  final String processingStatus;
  final int? duration;

  AChatAttachment({
    required this.id,
    required this.type,
    required this.url,
    this.thumbnailUrl,
    required this.filename,
    required this.originalFilename,
    required this.size,
    this.width,
    this.height,
    required this.mimeType,
    this.downloadUrl,
    this.expiresAt,
    required this.processingStatus,
    this.duration,
  });

  factory AChatAttachment.fromJson(Map<String, dynamic> json) {
    return AChatAttachment(
      id: json['id'] as String,
      type: json['type'] as String,
      url: json['url'] as String,
      thumbnailUrl: json['thumbnail_url'] as String?,
      filename: json['filename'] as String,
      originalFilename: json['original_filename'] as String,
      size: json['size'] as int,
      width: json['width'] as int?,
      height: json['height'] as int?,
      mimeType: json['mime_type'] as String,
      downloadUrl: json['download_url'] as String?,
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : null,
      processingStatus: json['processing_status'] as String? ?? 'completed',
      duration: json['duration'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type,
      'url': url,
      'thumbnail_url': thumbnailUrl,
      'filename': filename,
      'original_filename': originalFilename,
      'size': size,
      'width': width,
      'height': height,
      'mime_type': mimeType,
      'download_url': downloadUrl,
      'expires_at': expiresAt?.toIso8601String(),
      'processing_status': processingStatus,
      'duration': duration,
    };
  }

  /// Check if attachment is an image
  bool get isImage => type == 'image' || mimeType.startsWith('image/');

  /// Check if attachment is a video
  bool get isVideo => type == 'video' || mimeType.startsWith('video/');

  /// Check if attachment is an audio file
  bool get isAudio => type == 'audio' || mimeType.startsWith('audio/');

  /// Check if attachment is a document
  bool get isDocument => type == 'document' || (!isImage && !isVideo && !isAudio);

  /// Get human-readable file size
  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    if (size < 1024 * 1024 * 1024) return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
    return '${(size / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  /// Check if processing is complete
  bool get isProcessingComplete => processingStatus == 'completed';

  /// Check if processing failed
  bool get isProcessingFailed => processingStatus == 'failed';
}

/// Message reaction
class AChatReaction {
  final String emoji;
  final int count;
  final List<AChatReactionUser> users;
  final bool userReacted;

  AChatReaction({
    required this.emoji,
    required this.count,
    required this.users,
    required this.userReacted,
  });

  factory AChatReaction.fromJson(Map<String, dynamic> json) {
    return AChatReaction(
      emoji: json['emoji'] as String,
      count: json['count'] as int,
      users: (json['users'] as List? ?? [])
          .map((item) => AChatReactionUser.fromJson(item as Map<String, dynamic>))
          .toList(),
      userReacted: json['user_reacted'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'emoji': emoji,
      'count': count,
      'users': users.map((user) => user.toJson()).toList(),
      'user_reacted': userReacted,
    };
  }
}

/// User who reacted to message
class AChatReactionUser {
  final String id;
  final String name;

  AChatReactionUser({
    required this.id,
    required this.name,
  });

  factory AChatReactionUser.fromJson(Map<String, dynamic> json) {
    return AChatReactionUser(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
    };
  }
}

/// Message read status
class AChatReadStatus {
  final String userId;
  final DateTime readAt;

  AChatReadStatus({
    required this.userId,
    required this.readAt,
  });

  factory AChatReadStatus.fromJson(Map<String, dynamic> json) {
    return AChatReadStatus(
      userId: json['user_id'] as String,
      readAt: DateTime.parse(json['read_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'read_at': readAt.toIso8601String(),
    };
  }
}

/// Message metadata
class AChatMessageMetadata {
  final String? clientId;
  final String? encryptionVersion;
  final List<AChatEditHistory> editHistory;
  final List<String> mentions;
  final AChatRichText? richText;

  AChatMessageMetadata({
    this.clientId,
    this.encryptionVersion,
    required this.editHistory,
    required this.mentions,
    this.richText,
  });

  factory AChatMessageMetadata.fromJson(Map<String, dynamic> json) {
    return AChatMessageMetadata(
      clientId: json['client_id'] as String?,
      encryptionVersion: json['encryption_version'] as String?,
      editHistory: (json['edit_history'] as List? ?? [])
          .map((item) => AChatEditHistory.fromJson(item as Map<String, dynamic>))
          .toList(),
      mentions: List<String>.from(json['mentions'] as List? ?? []),
      richText: json['rich_text'] != null
          ? AChatRichText.fromJson(json['rich_text'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'client_id': clientId,
      'encryption_version': encryptionVersion,
      'edit_history': editHistory.map((item) => item.toJson()).toList(),
      'mentions': mentions,
      'rich_text': richText?.toJson(),
    };
  }
}

/// Message edit history
class AChatEditHistory {
  final String previousContent;
  final DateTime editedAt;
  final String editedBy;
  final String? editReason;

  AChatEditHistory({
    required this.previousContent,
    required this.editedAt,
    required this.editedBy,
    this.editReason,
  });

  factory AChatEditHistory.fromJson(Map<String, dynamic> json) {
    return AChatEditHistory(
      previousContent: json['previous_content'] as String,
      editedAt: DateTime.parse(json['edited_at'] as String),
      editedBy: json['edited_by'] as String,
      editReason: json['edit_reason'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'previous_content': previousContent,
      'edited_at': editedAt.toIso8601String(),
      'edited_by': editedBy,
      'edit_reason': editReason,
    };
  }
}

/// Rich text formatting
class AChatRichText {
  final List<List<int>> bold;
  final List<List<int>> italic;
  final List<List<int>> underline;
  final List<List<int>> strikethrough;
  final List<AChatTextLink> links;

  AChatRichText({
    required this.bold,
    required this.italic,
    required this.underline,
    required this.strikethrough,
    required this.links,
  });

  factory AChatRichText.fromJson(Map<String, dynamic> json) {
    return AChatRichText(
      bold: (json['bold'] as List? ?? [])
          .map((item) => List<int>.from(item as List))
          .toList(),
      italic: (json['italic'] as List? ?? [])
          .map((item) => List<int>.from(item as List))
          .toList(),
      underline: (json['underline'] as List? ?? [])
          .map((item) => List<int>.from(item as List))
          .toList(),
      strikethrough: (json['strikethrough'] as List? ?? [])
          .map((item) => List<int>.from(item as List))
          .toList(),
      links: (json['links'] as List? ?? [])
          .map((item) => AChatTextLink.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'bold': bold,
      'italic': italic,
      'underline': underline,
      'strikethrough': strikethrough,
      'links': links.map((link) => link.toJson()).toList(),
    };
  }
}

/// Text link in rich text
class AChatTextLink {
  final List<int> range;
  final String url;

  AChatTextLink({
    required this.range,
    required this.url,
  });

  factory AChatTextLink.fromJson(Map<String, dynamic> json) {
    return AChatTextLink(
      range: List<int>.from(json['range'] as List),
      url: json['url'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'range': range,
      'url': url,
    };
  }
}

/// File information for uploads
class AChatFileInfo {
  final String id;
  final String url;
  final String? thumbnailUrl;
  final String filename;
  final String originalFilename;
  final int size;
  final String type;
  final String mimeType;
  final int? width;
  final int? height;
  final int? duration;
  final String? encryptionKey;
  final DateTime uploadedAt;

  AChatFileInfo({
    required this.id,
    required this.url,
    this.thumbnailUrl,
    required this.filename,
    required this.originalFilename,
    required this.size,
    required this.type,
    required this.mimeType,
    this.width,
    this.height,
    this.duration,
    this.encryptionKey,
    required this.uploadedAt,
  });

  factory AChatFileInfo.fromJson(Map<String, dynamic> json) {
    return AChatFileInfo(
      id: json['id'] as String,
      url: json['url'] as String,
      thumbnailUrl: json['thumbnail_url'] as String?,
      filename: json['filename'] as String,
      originalFilename: json['original_filename'] as String,
      size: json['size'] as int,
      type: json['type'] as String,
      mimeType: json['mime_type'] as String,
      width: json['width'] as int?,
      height: json['height'] as int?,
      duration: json['duration'] as int?,
      encryptionKey: json['encryption_key'] as String?,
      uploadedAt: DateTime.parse(json['uploaded_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'url': url,
      'thumbnail_url': thumbnailUrl,
      'filename': filename,
      'original_filename': originalFilename,
      'size': size,
      'type': type,
      'mime_type': mimeType,
      'width': width,
      'height': height,
      'duration': duration,
      'encryption_key': encryptionKey,
      'uploaded_at': uploadedAt.toIso8601String(),
    };
  }

  /// Convert to attachment
  AChatAttachment toAttachment() {
    return AChatAttachment(
      id: id,
      type: type,
      url: url,
      thumbnailUrl: thumbnailUrl,
      filename: filename,
      originalFilename: originalFilename,
      size: size,
      width: width,
      height: height,
      mimeType: mimeType,
      processingStatus: 'completed',
      duration: duration,
    );
  }
}