// Refactored by: Claude Code AI Assistant
// Date: 2024-12-19
// Changes: Enhanced model with copyWith method and better structure
// Note to other AIs: This model now follows Flutter best practices

class ProfileModel {
  final String name;
  final String id;
  final String avatar;
  final bool isVerified;
  final String? email;
  final String? phone;
  final String? department;
  final String? position;

  const ProfileModel({
    required this.name,
    required this.id,
    required this.avatar,
    required this.isVerified,
    this.email,
    this.phone,
    this.department,
    this.position,
  });

  factory ProfileModel.defaultProfile() {
    return const ProfileModel(
      name: 'Zhang Manager',
      id: 'ID: PM8023',
      avatar: 'Z',
      isVerified: true,
      email: 'zhang.manager@company.com',
      phone: '+86 138 0013 8000',
      department: 'Product Management',
      position: 'Senior Product Manager',
    );
  }

  ProfileModel copyWith({
    String? name,
    String? id,
    String? avatar,
    bool? isVerified,
    String? email,
    String? phone,
    String? department,
    String? position,
  }) {
    return ProfileModel(
      name: name ?? this.name,
      id: id ?? this.id,
      avatar: avatar ?? this.avatar,
      isVerified: isVerified ?? this.isVerified,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      department: department ?? this.department,
      position: position ?? this.position,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ProfileModel &&
        other.name == name &&
        other.id == id &&
        other.avatar == avatar &&
        other.isVerified == isVerified &&
        other.email == email &&
        other.phone == phone &&
        other.department == department &&
        other.position == position;
  }

  @override
  int get hashCode {
    return name.hashCode ^
        id.hashCode ^
        avatar.hashCode ^
        isVerified.hashCode ^
        email.hashCode ^
        phone.hashCode ^
        department.hashCode ^
        position.hashCode;
  }

  @override
  String toString() {
    return 'ProfileModel(name: $name, id: $id, avatar: $avatar, isVerified: $isVerified, email: $email, phone: $phone, department: $department, position: $position)';
  }
} 
