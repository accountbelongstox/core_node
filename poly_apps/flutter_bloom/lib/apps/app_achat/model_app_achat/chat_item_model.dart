/// Chat item model for AChat app
/// Represents a chat conversation in the chat list
/// Located in models_app_achat/ according to Flutter development standards
class ChatItemModel {
  final String id;
  final String name;
  final String lastMessage;
  final DateTime timestamp;
  int unreadCount;
  final String? avatarUrl;
  final bool isOnline;
  final bool isGroup;
  final bool isPinned;
  final bool isMuted;
  final bool isAvailable;

  ChatItemModel({
    required this.id,
    required this.name,
    required this.lastMessage,
    required this.timestamp,
    this.unreadCount = 0,
    this.avatarUrl,
    this.isOnline = false,
    this.isGroup = false,
    this.isPinned = false,
    this.isMuted = false,
    this.isAvailable = true,
  });

  ChatItemModel copyWith({
    String? id,
    String? name,
    String? lastMessage,
    DateTime? timestamp,
    int? unreadCount,
    String? avatarUrl,
    bool? isOnline,
    bool? isGroup,
    bool? isPinned,
    bool? isMuted,
    bool? isAvailable,
  }) {
    return ChatItemModel(
      id: id ?? this.id,
      name: name ?? this.name,
      lastMessage: lastMessage ?? this.lastMessage,
      timestamp: timestamp ?? this.timestamp,
      unreadCount: unreadCount ?? this.unreadCount,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isOnline: isOnline ?? this.isOnline,
      isGroup: isGroup ?? this.isGroup,
      isPinned: isPinned ?? this.isPinned,
      isMuted: isMuted ?? this.isMuted,
      isAvailable: isAvailable ?? this.isAvailable,
    );
  }

  void markAsRead() {
    unreadCount = 0;
  }

  String get displayName => name;
  
  String get displayMessage => lastMessage;
  
  bool get hasUnreadMessages => unreadCount > 0;
  
  String get timeDisplay {
    final now = DateTime.now();
    final difference = now.difference(timestamp);
    
    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d';
    } else {
      return '${timestamp.day}/${timestamp.month}';
    }
  }

  String get avatarText {
    if (name.isEmpty) return '?';
    return name[0].toUpperCase();
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
    return 'ChatItemModel(id: $id, name: $name, lastMessage: $lastMessage, timestamp: $timestamp, unreadCount: $unreadCount, avatarUrl: $avatarUrl, isOnline: $isOnline, isGroup: $isGroup, isPinned: $isPinned, isMuted: $isMuted, isAvailable: $isAvailable)';
  }
}
