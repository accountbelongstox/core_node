class ChatMessageModel {
  final String sender;
  final String content;
  final String time;
  final String avatar;
  final bool isMe;

  ChatMessageModel({
    required this.sender,
    required this.content,
    required this.time,
    required this.avatar,
    required this.isMe,
  });

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    return ChatMessageModel(
      sender: json['sender'] ?? '',
      content: json['content'] ?? '',
      time: json['time'] ?? '',
      avatar: json['avatar'] ?? '',
      isMe: json['isMe'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sender': sender,
      'content': content,
      'time': time,
      'avatar': avatar,
      'isMe': isMe,
    };
  }
} 
