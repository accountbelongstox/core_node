// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'storage_entity.dart';
import 'storage_result.dart';

/// User entity for storing user information
class UserEntity extends BaseStorageEntity {
  final String email;
  final String? name;
  final String? avatarUrl;
  final Map<String, dynamic> preferences;
  final bool isActive;
  final String? role;
  final DateTime? lastLoginAt;
  final Map<String, dynamic> metadata;
  
  const UserEntity({
    required super.id,
    required super.createdAt,
    required super.updatedAt,
    super.version = 1,
    required this.email,
    this.name,
    this.avatarUrl,
    this.preferences = const {},
    this.isActive = true,
    this.role,
    this.lastLoginAt,
    this.metadata = const {},
  });
  
  @override
  String get entityType => 'user';
  
  @override
  bool validate() {
    return super.validate() &&
           email.isNotEmpty &&
           email.contains('@') &&
           (name == null || name!.isNotEmpty);
  }
  
  @override
  Map<String, dynamic> toMap() {
    return {
      ...super.toMap(),
      'email': email,
      'name': name,
      'avatarUrl': avatarUrl,
      'preferences': preferences,
      'isActive': isActive,
      'role': role,
      'lastLoginAt': lastLoginAt?.toIso8601String(),
      'metadata': metadata,
    };
  }
  
  static UserEntity fromMap(Map<String, dynamic> map) {
    return UserEntity(
      id: map['id'] as String,
      createdAt: DateTime.parse(map['createdAt'] as String),
      updatedAt: DateTime.parse(map['updatedAt'] as String),
      version: map['version'] as int? ?? 1,
      email: map['email'] as String,
      name: map['name'] as String?,
      avatarUrl: map['avatarUrl'] as String?,
      preferences: Map<String, dynamic>.from(map['preferences'] ?? {}),
      isActive: map['isActive'] as bool? ?? true,
      role: map['role'] as String?,
      lastLoginAt: map['lastLoginAt'] != null 
          ? DateTime.parse(map['lastLoginAt'] as String)
          : null,
      metadata: Map<String, dynamic>.from(map['metadata'] ?? {}),
    );
  }
  
  @override
  StorageEntity copyWithUpdatedAt(DateTime updatedAt) {
    return copyWith(updatedAt: updatedAt);
  }
  
  @override
  StorageResult<void> validateForStorage() {
    if (!validate()) {
      return StorageError.withCode(
        'INVALID_ENTITY',
        'Entity validation failed',
        metadata: {'entityType': entityType, 'id': id},
      );
    }
    
    if (id.isEmpty) {
      return StorageError.withCode(
        'EMPTY_ID',
        'Entity ID cannot be empty',
        metadata: {'entityType': entityType},
      );
    }
    
    if (createdAt.isAfter(updatedAt)) {
      return StorageError.withCode(
        'INVALID_TIMESTAMPS',
        'CreatedAt cannot be after UpdatedAt',
        metadata: {'entityType': entityType, 'id': id},
      );
    }
    
    return const StorageSuccess(null);
  }
  
  UserEntity copyWith({
    String? id,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? version,
    String? email,
    String? name,
    String? avatarUrl,
    Map<String, dynamic>? preferences,
    bool? isActive,
    String? role,
    DateTime? lastLoginAt,
    Map<String, dynamic>? metadata,
  }) {
    return UserEntity(
      id: id ?? this.id,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      version: version ?? this.version,
      email: email ?? this.email,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      preferences: preferences ?? this.preferences,
      isActive: isActive ?? this.isActive,
      role: role ?? this.role,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      metadata: metadata ?? this.metadata,
    );
  }
  
  /// Create a new user entity
  factory UserEntity.create({
    required String id,
    required String email,
    String? name,
    String? avatarUrl,
    Map<String, dynamic>? preferences,
    String? role,
    Map<String, dynamic>? metadata,
  }) {
    final now = DateTime.now();
    return UserEntity(
      id: id,
      createdAt: now,
      updatedAt: now,
      email: email,
      name: name,
      avatarUrl: avatarUrl,
      preferences: preferences ?? {},
      role: role,
      metadata: metadata ?? {},
    );
  }
  
  /// Update last login time
  UserEntity updateLastLogin() {
    return copyWith(
      lastLoginAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }
  
  /// Update user preferences
  UserEntity updatePreferences(Map<String, dynamic> newPreferences) {
    return copyWith(
      preferences: {...preferences, ...newPreferences},
      updatedAt: DateTime.now(),
    );
  }
  
  /// Deactivate user
  UserEntity deactivate() {
    return copyWith(
      isActive: false,
      updatedAt: DateTime.now(),
    );
  }
  
  /// Activate user
  UserEntity activate() {
    return copyWith(
      isActive: true,
      updatedAt: DateTime.now(),
    );
  }
  
  @override
  String toString() => 'UserEntity(id: $id, email: $email, name: $name, isActive: $isActive)';
  
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is UserEntity &&
          super == other &&
          other.email == email &&
          other.name == name &&
          other.isActive == isActive);
  
  @override
  int get hashCode => Object.hash(super.hashCode, email, name, isActive);
}
