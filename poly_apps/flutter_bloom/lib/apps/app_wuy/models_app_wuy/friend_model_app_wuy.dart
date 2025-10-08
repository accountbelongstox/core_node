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
  final String displayName;
  final String? avatarUrl;
  final String? phoneNumber;
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
    required this.displayName,
    this.avatarUrl,
    this.phoneNumber,
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
      displayName: json['display_name'] as String? ?? json['displayName'] as String? ?? json['username'] as String,
      avatarUrl: json['avatar_url'] as String? ?? json['avatarUrl'] as String? ?? json['avatar'] as String?,
      phoneNumber: json['phone_number'] as String? ?? json['phoneNumber'] as String? ?? json['phone'] as String?,
      bio: json['bio'] as String?,
      isOnline: json['is_online'] as bool? ?? json['isOnline'] as bool? ?? false,
      lastSeen: json['last_seen'] != null 
          ? DateTime.parse(json['last_seen'] as String)
          : json['lastSeen'] != null 
              ? DateTime.parse(json['lastSeen'] as String)
              : null,
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updated_at'] != null 
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.parse(json['updatedAt'] as String),
      isBlocked: json['is_blocked'] as bool? ?? json['isBlocked'] as bool? ?? false,
      isFavorite: json['is_favorite'] as bool? ?? json['isFavorite'] as bool? ?? false,
      relationship: json['relationship'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'display_name': displayName,
      'avatar_url': avatarUrl,
      'phone_number': phoneNumber,
      'bio': bio,
      'is_online': isOnline,
      'last_seen': lastSeen?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'is_blocked': isBlocked,
      'is_favorite': isFavorite,
      'relationship': relationship,
      'metadata': metadata,
    };
  }

  FriendModelAppWuy copyWith({
    String? id,
    String? username,
    String? displayName,
    String? avatarUrl,
    String? phoneNumber,
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
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      phoneNumber: phoneNumber ?? this.phoneNumber,
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

  String get displayNameOrUsername => displayName.isNotEmpty ? displayName : username;

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
