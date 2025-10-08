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

class FriendModelAppWuy {
  final String id;
  final String username;
  final String? nickname;
  final String? avatar;
  final String? phone;
  final String? bio;
  final bool isOnline;
  final DateTime? lastSeen;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isBlocked;
  final bool isFavorite;
  final String? relationship;
  final Map<String, dynamic>? metadata;

  const FriendModelAppWuy({
    required this.id,
    required this.username,
    this.nickname,
    this.avatar,
    this.phone,
    this.bio,
    this.isOnline = false,
    this.lastSeen,
    required this.createdAt,
    required this.updatedAt,
    this.isBlocked = false,
    this.isFavorite = false,
    this.relationship,
    this.metadata,
  });

  factory FriendModelAppWuy.fromJson(Map<String, dynamic> json) {
    return FriendModelAppWuy(
      id: json['id'] as String,
      username: json['username'] as String,
      nickname: json['nickname'] as String?,
      avatar: json['avatar'] as String?,
      phone: json['phone'] as String?,
      bio: json['bio'] as String?,
      isOnline: json['isOnline'] as bool? ?? false,
      lastSeen: json['lastSeen'] != null 
          ? DateTime.parse(json['lastSeen'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      isBlocked: json['isBlocked'] as bool? ?? false,
      isFavorite: json['isFavorite'] as bool? ?? false,
      relationship: json['relationship'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'nickname': nickname,
      'avatar': avatar,
      'phone': phone,
      'bio': bio,
      'isOnline': isOnline,
      'lastSeen': lastSeen?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'isBlocked': isBlocked,
      'isFavorite': isFavorite,
      'relationship': relationship,
      'metadata': metadata,
    };
  }

  FriendModelAppWuy copyWith({
    String? id,
    String? username,
    String? nickname,
    String? avatar,
    String? phone,
    String? bio,
    bool? isOnline,
    DateTime? lastSeen,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isBlocked,
    bool? isFavorite,
    String? relationship,
    Map<String, dynamic>? metadata,
  }) {
    return FriendModelAppWuy(
      id: id ?? this.id,
      username: username ?? this.username,
      nickname: nickname ?? this.nickname,
      avatar: avatar ?? this.avatar,
      phone: phone ?? this.phone,
      bio: bio ?? this.bio,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isBlocked: isBlocked ?? this.isBlocked,
      isFavorite: isFavorite ?? this.isFavorite,
      relationship: relationship ?? this.relationship,
      metadata: metadata ?? this.metadata,
    );
  }

  String get displayName => nickname ?? username;

  String get statusText {
    if (isOnline) return 'Online';
    if (lastSeen != null) {
      final now = DateTime.now();
      final difference = now.difference(lastSeen!);
      if (difference.inMinutes < 1) return 'Just now';
      if (difference.inHours < 1) return '${difference.inMinutes}m ago';
      if (difference.inDays < 1) return '${difference.inHours}h ago';
      return '${difference.inDays}d ago';
    }
    return 'Offline';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is FriendModelAppWuy && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'FriendModelAppWuy(id: $id, username: $username, displayName: $displayName)';
  }
}
