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

import '../../../common/provider_status/user_provider.dart';

/// Wuy App User Model
/// Extends LaravelUserModel from common library to ensure consistency
/// Provides app-specific user functionality while maintaining compatibility
class UserModelAppWuy extends LaravelUserModel {
  // App-specific fields
  final bool isOnline;
  final bool isVerified;
  final String? bio;
  final DateTime? lastSeen;
  final String? firstName;
  final String? lastName;
  final String? phoneNumber;
  final String? avatarUrl;
  final bool isActive;

  const UserModelAppWuy({
    // LaravelUserModel fields
    super.id,
    super.name,
    super.nickname,
    super.username,
    super.email,
    super.emailVerifiedAt,
    super.avatar,
    super.about,
    super.followers,
    super.website,
    super.github,
    super.wechat,
    super.weibo,
    super.qq,
    super.age,
    super.gender,
    super.birthday,
    super.city,
    super.education,
    super.occupation,
    super.language,
    super.religion,
    super.roleLevel,
    super.roleName,
    super.userToken,
    super.createdAt,
    super.updatedAt,
    super.authMetadata,
    super.phone,
    super.mobile,
    super.country,
    super.province,
    super.cityDistrict,
    super.address,
    super.postalCode,
    super.timezone,
    super.lastLoginIp,
    super.lastLoginAt,
    super.isTwoFactorEnabled,
    super.twoFactorSecret,
    super.permissions,
    super.permissionGroups,
    super.roles,
    super.teams,
    super.preferences,
    super.meta,
    // App-specific fields
    this.isOnline = false,
    this.isVerified = false,
    this.bio,
    this.lastSeen,
    this.firstName,
    this.lastName,
    this.phoneNumber,
    this.avatarUrl,
    this.isActive = true,
  });

  factory UserModelAppWuy.fromJson(Map<String, dynamic> json) {
    return UserModelAppWuy(
      // LaravelUserModel fields
      id: json['id'] != null ? int.tryParse(json['id'].toString()) : null,
      name: json['name']?.toString(),
      nickname: json['nickname']?.toString(),
      username: json['username']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      emailVerifiedAt: json['email_verified_at'] != null 
          ? DateTime.tryParse(json['email_verified_at'].toString())
          : null,
      avatar: json['avatar']?.toString(),
      about: json['about']?.toString(),
      followers: json['followers']?.toString(),
      website: json['website']?.toString(),
      github: json['github']?.toString(),
      wechat: json['wechat']?.toString(),
      weibo: json['weibo']?.toString(),
      qq: json['qq']?.toString(),
      age: json['age']?.toString(),
      gender: json['gender']?.toString(),
      birthday: json['birthday']?.toString(),
      city: json['city']?.toString(),
      education: json['education']?.toString(),
      occupation: json['occupation']?.toString(),
      language: json['language']?.toString(),
      religion: json['religion']?.toString(),
      roleLevel: json['role_level'] as int? ?? json['roleLevel'] as int?,
      roleName: json['role_name']?.toString() ?? json['roleName']?.toString(),
      userToken: json['user_token']?.toString() ?? json['userToken']?.toString(),
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at'].toString())
          : json['createdAt'] != null 
              ? DateTime.tryParse(json['createdAt'].toString())
              : DateTime.now(),
      updatedAt: json['updated_at'] != null 
          ? DateTime.tryParse(json['updated_at'].toString())
          : json['updatedAt'] != null 
              ? DateTime.tryParse(json['updatedAt'].toString())
              : DateTime.now(),
      phone: json['phone']?.toString(),
      mobile: json['mobile']?.toString(),
      country: json['country']?.toString(),
      province: json['province']?.toString(),
      cityDistrict: json['city_district']?.toString() ?? json['cityDistrict']?.toString(),
      address: json['address']?.toString(),
      postalCode: json['postal_code']?.toString() ?? json['postalCode']?.toString(),
      timezone: json['timezone']?.toString(),
      lastLoginIp: json['last_login_ip']?.toString() ?? json['lastLoginIp']?.toString(),
      lastLoginAt: json['last_login_at'] != null 
          ? DateTime.tryParse(json['last_login_at'].toString())
          : json['lastLoginAt'] != null 
              ? DateTime.tryParse(json['lastLoginAt'].toString())
              : null,
      isTwoFactorEnabled: json['is_two_factor_enabled'] as bool? ?? json['isTwoFactorEnabled'] as bool? ?? false,
      twoFactorSecret: json['two_factor_secret']?.toString() ?? json['twoFactorSecret']?.toString(),
      permissions: json['permissions'] != null 
          ? List<String>.from(json['permissions'] as List)
          : const <String>[],
      permissionGroups: json['permission_groups'] != null 
          ? List<String>.from(json['permission_groups'] as List)
          : json['permissionGroups'] != null 
              ? List<String>.from(json['permissionGroups'] as List)
              : const <String>[],
      roles: json['roles'] != null 
          ? List<String>.from(json['roles'] as List)
          : const <String>[],
      teams: json['teams'] != null 
          ? List<String>.from(json['teams'] as List)
          : const <String>[],
      preferences: json['preferences'] as Map<String, dynamic>? ?? const <String, dynamic>{},
      meta: json['meta'] as Map<String, dynamic>? ?? const <String, dynamic>{},
      // App-specific fields
      isOnline: json['is_online'] as bool? ?? json['isOnline'] as bool? ?? false,
      isVerified: json['is_verified'] as bool? ?? json['isVerified'] as bool? ?? false,
      bio: json['bio']?.toString(),
      lastSeen: json['last_seen'] != null 
          ? DateTime.tryParse(json['last_seen'].toString())
          : json['lastSeen'] != null 
              ? DateTime.tryParse(json['lastSeen'].toString())
              : null,
      firstName: json['first_name']?.toString() ?? json['firstName']?.toString(),
      lastName: json['last_name']?.toString() ?? json['lastName']?.toString(),
      phoneNumber: json['phone_number']?.toString() ?? json['phoneNumber']?.toString(),
      avatarUrl: json['avatar_url']?.toString() ?? json['avatarUrl']?.toString(),
      isActive: json['is_active'] as bool? ?? json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    final baseJson = super.toMap();
    return {
      ...baseJson,
      // App-specific fields
      'is_online': isOnline,
      'is_verified': isVerified,
      'bio': bio,
      'last_seen': lastSeen?.toIso8601String(),
      'first_name': firstName,
      'last_name': lastName,
      'phone_number': phoneNumber,
      'avatar_url': avatarUrl,
      'is_active': isActive,
      // Ensure API compatibility - map app-specific fields to API expected fields
      'phone': phoneNumber ?? phone, // Use phoneNumber if available, fallback to phone
      'avatar': avatarUrl ?? avatar, // Use avatarUrl if available, fallback to avatar
    };
  }

  @override
  UserModelAppWuy copyWith({
    int? id,
    String? name,
    String? nickname,
    String? username,
    String? email,
    DateTime? emailVerifiedAt,
    String? avatar,
    String? about,
    String? followers,
    String? website,
    String? github,
    String? wechat,
    String? weibo,
    String? qq,
    String? age,
    String? gender,
    String? birthday,
    String? city,
    String? education,
    String? occupation,
    String? language,
    String? religion,
    int? roleLevel,
    String? roleName,
    String? userToken,
    DateTime? createdAt,
    DateTime? updatedAt,
    AuthMetadata? authMetadata,
    String? phone,
    String? mobile,
    String? country,
    String? province,
    String? cityDistrict,
    String? address,
    String? postalCode,
    String? timezone,
    String? lastLoginIp,
    DateTime? lastLoginAt,
    bool? isTwoFactorEnabled,
    String? twoFactorSecret,
    List<String>? permissions,
    List<String>? permissionGroups,
    List<String>? roles,
    List<String>? teams,
    Map<String, dynamic>? preferences,
    Map<String, dynamic>? meta,
    // App-specific fields
    bool? isOnline,
    bool? isVerified,
    String? bio,
    DateTime? lastSeen,
    String? firstName,
    String? lastName,
    String? phoneNumber,
    String? avatarUrl,
    bool? isActive,
  }) {
    return UserModelAppWuy(
      // LaravelUserModel fields
      id: id ?? this.id,
      name: name ?? this.name,
      nickname: nickname ?? this.nickname,
      username: username ?? this.username,
      email: email ?? this.email,
      emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
      avatar: avatar ?? this.avatar,
      about: about ?? this.about,
      followers: followers ?? this.followers,
      website: website ?? this.website,
      github: github ?? this.github,
      wechat: wechat ?? this.wechat,
      weibo: weibo ?? this.weibo,
      qq: qq ?? this.qq,
      age: age ?? this.age,
      gender: gender ?? this.gender,
      birthday: birthday ?? this.birthday,
      city: city ?? this.city,
      education: education ?? this.education,
      occupation: occupation ?? this.occupation,
      language: language ?? this.language,
      religion: religion ?? this.religion,
      roleLevel: roleLevel ?? this.roleLevel,
      roleName: roleName ?? this.roleName,
      userToken: userToken ?? this.userToken,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      authMetadata: authMetadata ?? this.authMetadata,
      phone: phone ?? this.phone,
      mobile: mobile ?? this.mobile,
      country: country ?? this.country,
      province: province ?? this.province,
      cityDistrict: cityDistrict ?? this.cityDistrict,
      address: address ?? this.address,
      postalCode: postalCode ?? this.postalCode,
      timezone: timezone ?? this.timezone,
      lastLoginIp: lastLoginIp ?? this.lastLoginIp,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      isTwoFactorEnabled: isTwoFactorEnabled ?? this.isTwoFactorEnabled,
      twoFactorSecret: twoFactorSecret ?? this.twoFactorSecret,
      permissions: permissions ?? this.permissions,
      permissionGroups: permissionGroups ?? this.permissionGroups,
      roles: roles ?? this.roles,
      teams: teams ?? this.teams,
      preferences: preferences ?? this.preferences,
      meta: meta ?? this.meta,
      // App-specific fields
      isOnline: isOnline ?? this.isOnline,
      isVerified: isVerified ?? this.isVerified,
      bio: bio ?? this.bio,
      lastSeen: lastSeen ?? this.lastSeen,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isActive: isActive ?? this.isActive,
    );
  }

  String get displayName {
    if (firstName != null && lastName != null) {
      return '$firstName $lastName';
    } else if (firstName != null) {
      return firstName!;
    } else if (lastName != null) {
      return lastName!;
    }
    return nickname ?? name ?? username ?? '';
  }

  String get unifiedPhoneNumber => phoneNumber ?? phone ?? '';

  String get unifiedAvatarUrl => avatarUrl ?? avatar ?? '';

  bool hasRole(String role) {
    return roles.contains(role);
  }

  T? getPreference<T>(String key) {
    return preferences[key] as T?;
  }

  UserModelAppWuy setPreference(String key, dynamic value) {
    final newPreferences = Map<String, dynamic>.from(preferences);
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
    return 'UserModelAppWuy(id: $id, username: $username, email: $email, displayName: $displayName, isOnline: $isOnline)';
  }
}
