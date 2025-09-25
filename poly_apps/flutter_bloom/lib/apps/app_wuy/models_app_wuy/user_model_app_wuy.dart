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

class UserModelAppWuy {
  final String id;
  final String username;
  final String email;
  final String? avatar;
  final String? nickname;
  final String? phone;
  final String? bio;
  final DateTime? lastSeen;
  final bool isOnline;
  final bool isVerified;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, dynamic>? preferences;
  final List<String>? roles;

  const UserModelAppWuy({
    required this.id,
    required this.username,
    required this.email,
    this.avatar,
    this.nickname,
    this.phone,
    this.bio,
    this.lastSeen,
    this.isOnline = false,
    this.isVerified = false,
    required this.createdAt,
    required this.updatedAt,
    this.preferences,
    this.roles,
  });

  factory UserModelAppWuy.fromJson(Map<String, dynamic> json) {
    return UserModelAppWuy(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String,
      avatar: json['avatar'] as String?,
      nickname: json['nickname'] as String?,
      phone: json['phone'] as String?,
      bio: json['bio'] as String?,
      lastSeen: json['lastSeen'] != null 
          ? DateTime.parse(json['lastSeen'] as String)
          : null,
      isOnline: json['isOnline'] as bool? ?? false,
      isVerified: json['isVerified'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      preferences: json['preferences'] as Map<String, dynamic>?,
      roles: json['roles'] != null 
          ? List<String>.from(json['roles'] as List)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'avatar': avatar,
      'nickname': nickname,
      'phone': phone,
      'bio': bio,
      'lastSeen': lastSeen?.toIso8601String(),
      'isOnline': isOnline,
      'isVerified': isVerified,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'preferences': preferences,
      'roles': roles,
    };
  }

  UserModelAppWuy copyWith({
    String? id,
    String? username,
    String? email,
    String? avatar,
    String? nickname,
    String? phone,
    String? bio,
    DateTime? lastSeen,
    bool? isOnline,
    bool? isVerified,
    DateTime? createdAt,
    DateTime? updatedAt,
    Map<String, dynamic>? preferences,
    List<String>? roles,
  }) {
    return UserModelAppWuy(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      avatar: avatar ?? this.avatar,
      nickname: nickname ?? this.nickname,
      phone: phone ?? this.phone,
      bio: bio ?? this.bio,
      lastSeen: lastSeen ?? this.lastSeen,
      isOnline: isOnline ?? this.isOnline,
      isVerified: isVerified ?? this.isVerified,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      preferences: preferences ?? this.preferences,
      roles: roles ?? this.roles,
    );
  }

  String get displayName => nickname ?? username;

  bool hasRole(String role) {
    return roles?.contains(role) ?? false;
  }

  T? getPreference<T>(String key) {
    return preferences?[key] as T?;
  }

  UserModelAppWuy setPreference(String key, dynamic value) {
    final newPreferences = Map<String, dynamic>.from(preferences ?? {});
    newPreferences[key] = value;
    return copyWith(preferences: newPreferences);
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is UserModelAppWuy && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'UserModelAppWuy(id: $id, username: $username, email: $email)';
  }
}
