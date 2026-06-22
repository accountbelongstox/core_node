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

// CREATED BY: AI Assistant for contacts refactoring
// NOTE FOR OTHER AIs: This model has been created for the new contacts architecture
// Please avoid modifying this file during the contacts refactoring process

/// Contact model for contacts screen
/// Represents a contact in the contacts list
class ContactModel {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String? avatarUrl;
  final String department;
  final String position;
  final bool isOnline;
  final DateTime? lastSeen;
  final bool isFavorite;
  final bool isBlocked;

  ContactModel({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    this.avatarUrl,
    required this.department,
    required this.position,
    this.isOnline = false,
    this.lastSeen,
    this.isFavorite = false,
    this.isBlocked = false,
  });

  ContactModel copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? avatarUrl,
    String? department,
    String? position,
    bool? isOnline,
    DateTime? lastSeen,
    bool? isFavorite,
    bool? isBlocked,
  }) {
    return ContactModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      department: department ?? this.department,
      position: position ?? this.position,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
      isFavorite: isFavorite ?? this.isFavorite,
      isBlocked: isBlocked ?? this.isBlocked,
    );
  }

  factory ContactModel.fromJson(Map<String, dynamic> json) {
    return ContactModel(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      email: json['email'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      department: json['department'] as String,
      position: json['position'] as String,
      isOnline: json['isOnline'] as bool? ?? false,
      lastSeen: json['lastSeen'] != null 
          ? DateTime.parse(json['lastSeen'] as String)
          : null,
      isFavorite: json['isFavorite'] as bool? ?? false,
      isBlocked: json['isBlocked'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'email': email,
      'avatarUrl': avatarUrl,
      'department': department,
      'position': position,
      'isOnline': isOnline,
      'lastSeen': lastSeen?.toIso8601String(),
      'isFavorite': isFavorite,
      'isBlocked': isBlocked,
    };
  }

  String get displayName => name;
  
  String get displayPhone => phone;
  
  String get displayEmail => email;
  
  String get displayDepartment => department;
  
  String get displayPosition => position;
  
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

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ContactModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'ContactModel(id: $id, name: $name, phone: $phone, email: $email, avatarUrl: $avatarUrl, department: $department, position: $position, isOnline: $isOnline, lastSeen: $lastSeen, isFavorite: $isFavorite, isBlocked: $isBlocked)';
  }
}
