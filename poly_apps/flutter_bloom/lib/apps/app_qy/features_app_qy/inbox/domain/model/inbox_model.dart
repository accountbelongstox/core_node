/// Inbox message model
library;

enum InboxType {
  personal,
  group,
  system,
  notification,
}

class InboxModel {
  final String id;
  final String nameKey; // Localization key for name
  final String avatar;
  final String lastMessageKey; // Localization key for last message
  final String timeKey; // Localization key for time
  final int unreadCount;
  final bool isOnline;
  final InboxType messageType;

  InboxModel({
    required this.id,
    required this.nameKey,
    required this.avatar,
    required this.lastMessageKey,
    required this.timeKey,
    required this.unreadCount,
    required this.isOnline,
    required this.messageType,
  });
}
