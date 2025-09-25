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

// CREATED BY: AI Assistant for new_chat refactoring
// NOTE FOR OTHER AIs: This model has been created for the new new_chat architecture
// Please avoid modifying this file during the new_chat refactoring process

/// New Chat Contact model for new chat screen
/// Represents a contact available for starting a new chat
class NewChatContactModel {
  final String id;
  final String name;
  final String role;
  final String department;
  final String phone;
  final String email;
  final String? avatarUrl;
  final bool isOnline;
  final DateTime? lastSeen;
  final bool isFavorite;

  NewChatContactModel({
    required this.id,
    required this.name,
    required this.role,
    required this.department,
    required this.phone,
    required this.email,
    this.avatarUrl,
    this.isOnline = false,
    this.lastSeen,
    this.isFavorite = false,
  });

  NewChatContactModel copyWith({
    String? id,
    String? name,
    String? role,
    String? department,
    String? phone,
    String? email,
    String? avatarUrl,
    bool? isOnline,
    DateTime? lastSeen,
    bool? isFavorite,
  }) {
    return NewChatContactModel(
      id: id ?? this.id,
      name: name ?? this.name,
      role: role ?? this.role,
      department: department ?? this.department,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
      isFavorite: isFavorite ?? this.isFavorite,
    );
  }

  factory NewChatContactModel.fromJson(Map<String, dynamic> json) {
    return NewChatContactModel(
      id: json['id'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      department: json['department'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      isOnline: json['isOnline'] as bool? ?? false,
      lastSeen: json['lastSeen'] != null 
          ? DateTime.parse(json['lastSeen'] as String)
          : null,
      isFavorite: json['isFavorite'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'role': role,
      'department': department,
      'phone': phone,
      'email': email,
      'avatarUrl': avatarUrl,
      'isOnline': isOnline,
      'lastSeen': lastSeen?.toIso8601String(),
      'isFavorite': isFavorite,
    };
  }

  String get displayName => name;
  
  String get displayRole => role;
  
  String get displayDepartment => department;
  
  String get displayPhone => phone;
  
  String get displayEmail => email;
  
  String get avatarText {
    if (name.isEmpty) return '?';
    final words = name.split(' ');
    if (words.length >= 2) {
      return '${words[0][0]}${words[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  String get statusText {
    if (isOnline) {
      return 'Online';
    } else if (lastSeen != null) {
      final now = DateTime.now();
      final difference = now.difference(lastSeen!);
      
      if (difference.inMinutes < 1) {
        return 'Just now';
      } else if (difference.inMinutes < 60) {
        return '${difference.inMinutes}m ago';
      } else if (difference.inHours < 24) {
        return '${difference.inHours}h ago';
      } else if (difference.inDays < 7) {
        return '${difference.inDays}d ago';
      } else {
        return 'Last seen ${lastSeen!.day}/${lastSeen!.month}';
      }
    }
    return 'Offline';
  }

  String get fullDisplayInfo => '$displayName • $displayRole • $displayDepartment';

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is NewChatContactModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'NewChatContactModel(id: $id, name: $name, role: $role, department: $department, phone: $phone, email: $email, avatarUrl: $avatarUrl, isOnline: $isOnline, lastSeen: $lastSeen, isFavorite: $isFavorite)';
  }
}
