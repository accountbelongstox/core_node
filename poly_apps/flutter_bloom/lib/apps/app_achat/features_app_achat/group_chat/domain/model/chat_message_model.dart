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

// Message types for group chat
enum MessageType { text, image, file, voice, location, contact }

class ChatMessage {
  final String id;
  final String senderId;
  final String senderName;
  final String senderAvatar;
  final String content;
  final DateTime timestamp;
  final MessageType type;
  final bool isMe;
  final String? fileName;
  final String? filePath;
  final String? fileSize;
  final String? imageUrl;
  final String? voiceUrl;
  final int? voiceDuration;
  final Map<String, dynamic>? metadata;

  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.senderAvatar,
    required this.content,
    required this.timestamp,
    required this.type,
    required this.isMe,
    this.fileName,
    this.filePath,
    this.fileSize,
    this.imageUrl,
    this.voiceUrl,
    this.voiceDuration,
    this.metadata,
  });

  String get formattedTime {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(timestamp.year, timestamp.month, timestamp.day);
    
    if (messageDate == today) {
      return "${timestamp.hour.toString().padLeft(2, '0')}:${timestamp.minute.toString().padLeft(2, '0')}";
    } else if (messageDate == today.subtract(const Duration(days: 1))) {
      return 'Yesterday';
    } else {
      return "${timestamp.month.toString().padLeft(2, '0')}-${timestamp.day.toString().padLeft(2, '0')}";
    }
  }

  factory ChatMessage.text({
    required String id,
    required String senderId,
    required String senderName,
    required String senderAvatar,
    required String content,
    required DateTime timestamp,
    required bool isMe,
  }) {
    return ChatMessage(
      id: id,
      senderId: senderId,
      senderName: senderName,
      senderAvatar: senderAvatar,
      content: content,
      timestamp: timestamp,
      type: MessageType.text,
      isMe: isMe,
    );
  }

  factory ChatMessage.image({
    required String id,
    required String senderId,
    required String senderName,
    required String senderAvatar,
    required String imageUrl,
    required DateTime timestamp,
    required bool isMe,
    String? caption,
  }) {
    return ChatMessage(
      id: id,
      senderId: senderId,
      senderName: senderName,
      senderAvatar: senderAvatar,
      content: caption ?? '',
      timestamp: timestamp,
      type: MessageType.image,
      isMe: isMe,
      imageUrl: imageUrl,
    );
  }

  factory ChatMessage.file({
    required String id,
    required String senderId,
    required String senderName,
    required String senderAvatar,
    required String fileName,
    required String filePath,
    required String fileSize,
    required DateTime timestamp,
    required bool isMe,
  }) {
    return ChatMessage(
      id: id,
      senderId: senderId,
      senderName: senderName,
      senderAvatar: senderAvatar,
      content: fileName,
      timestamp: timestamp,
      type: MessageType.file,
      isMe: isMe,
      fileName: fileName,
      filePath: filePath,
      fileSize: fileSize,
    );
  }

  static List<ChatMessage> getDefaultMessages() {
    final now = DateTime.now();
    return [
      ChatMessage.text(
        id: '1',
        senderId: 'user1',
        senderName: 'Zhang Manager',
        senderAvatar: '张',
        content: 'Good morning everyone! Today we will discuss the new version UI design plan.',
        timestamp: now.subtract(const Duration(minutes: 30)),
        isMe: false,
      ),
      ChatMessage.text(
        id: '2',
        senderId: 'me',
        senderName: 'Me',
        senderAvatar: '我',
        content: 'Great! I have prepared the design draft.',
        timestamp: now.subtract(const Duration(minutes: 28)),
        isMe: true,
      ),
      ChatMessage.text(
        id: '3',
        senderId: 'user1',
        senderName: 'Zhang Manager',
        senderAvatar: '张',
        content: 'Please upload the design draft to the shared folder, and we will review it together.',
        timestamp: now.subtract(const Duration(minutes: 27)),
        isMe: false,
      ),
      ChatMessage.text(
        id: '4',
        senderId: 'me',
        senderName: 'Me',
        senderAvatar: '我',
        content: 'Already uploaded to the "UI Design/2024-02-24" folder.',
        timestamp: now.subtract(const Duration(minutes: 25)),
        isMe: true,
      ),
    ];
  }

  ChatMessage copyWith({
    String? id,
    String? senderId,
    String? senderName,
    String? senderAvatar,
    String? content,
    DateTime? timestamp,
    MessageType? type,
    bool? isMe,
    String? fileName,
    String? filePath,
    String? fileSize,
    String? imageUrl,
    String? voiceUrl,
    int? voiceDuration,
    Map<String, dynamic>? metadata,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      type: type ?? this.type,
      isMe: isMe ?? this.isMe,
      fileName: fileName ?? this.fileName,
      filePath: filePath ?? this.filePath,
      fileSize: fileSize ?? this.fileSize,
      imageUrl: imageUrl ?? this.imageUrl,
      voiceUrl: voiceUrl ?? this.voiceUrl,
      voiceDuration: voiceDuration ?? this.voiceDuration,
      metadata: metadata ?? this.metadata,
    );
  }
} 
